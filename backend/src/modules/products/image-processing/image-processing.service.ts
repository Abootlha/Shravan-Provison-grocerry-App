import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  isBgRemovalEnabled,
  isDataUri,
  processImage,
  resolvePipelineConfig,
} from './product-image-pipeline';
import type {
  BgProvider,
  PipelineConfig,
  PipelineDeps,
  ProcessedImage,
} from './product-image-pipeline';

export const IMAGE_PIPELINE_DEPS = 'IMAGE_PIPELINE_DEPS';

export interface ProductImageFields {
  image?: string;
  images?: string[];
}

/**
 * Pluggable product-image processing (background removal + pack-shot
 * normalisation). Provider is chosen by PRODUCT_IMAGE_BG_PROVIDER:
 * 'none' (default) | 'removebg' | 'local' (rembg CLI).
 */
@Injectable()
export class ImageProcessingService {
  private readonly logger = new Logger(ImageProcessingService.name);
  private readonly config: PipelineConfig;
  private readonly deps: PipelineDeps;

  constructor(
    configService: ConfigService,
    @Optional() @Inject(IMAGE_PIPELINE_DEPS) deps?: PipelineDeps,
  ) {
    this.config = resolvePipelineConfig({
      PRODUCT_IMAGE_BG_PROVIDER: configService.get<string>(
        'PRODUCT_IMAGE_BG_PROVIDER',
      ),
      REMOVE_BG_API_KEY: configService.get<string>('REMOVE_BG_API_KEY'),
      REMBG_BIN: configService.get<string>('REMBG_BIN'),
      PRODUCT_IMAGE_TIMEOUT_MS: configService.get<string>(
        'PRODUCT_IMAGE_TIMEOUT_MS',
      ),
    });
    this.deps = { logger: this.logger, ...deps };
    if (this.config.provider === 'removebg' && !this.config.removeBgApiKey) {
      this.logger.warn(
        'PRODUCT_IMAGE_BG_PROVIDER=removebg but REMOVE_BG_API_KEY is not set; background removal is disabled',
      );
    }
  }

  get provider(): BgProvider {
    return this.config.provider;
  }

  getProcessingConfig(): { provider: BgProvider; enabled: boolean } {
    return {
      provider: this.config.provider,
      enabled: isBgRemovalEnabled(this.config),
    };
  }

  /** Default for the `removeBackground` request flag. */
  get defaultRemoveBackground(): boolean {
    return this.config.provider !== 'none';
  }

  processImage(
    input: Buffer | string,
    options: { removeBackground?: boolean } = {},
  ): Promise<ProcessedImage> {
    return processImage(input, this.config, this.deps, options);
  }

  /**
   * Used on product create/update. Only base64 data-URI uploads are processed:
   * pasted http(s) URLs are left untouched, so the server never fetches
   * arbitrary admin-supplied URLs on save and stored URLs keep their form.
   * (Remote URLs can still be processed explicitly via the preview endpoint or
   * the batch script with --include-urls.) Never throws: on any failure the
   * original image is kept.
   *
   * `imageProcessed` is true only when every image is a successfully
   * processed upload (the batch script uses it as its idempotency marker).
   */
  async processProductImages<T extends ProductImageFields>(
    data: T,
    removeBackground?: boolean,
  ): Promise<T & { imageProcessed?: boolean }> {
    const enabled = removeBackground ?? this.defaultRemoveBackground;
    const touched = data.image !== undefined || data.images !== undefined;
    if (!touched) return data;
    if (!enabled) return { ...data, imageProcessed: false };

    const cache = new Map<string, string>();
    let allOk = true;
    const convert = async (value: string): Promise<string> => {
      if (!isDataUri(value)) {
        if (value) allOk = false; // URLs are kept as-is (not processed)
        return value;
      }
      const hit = cache.get(value);
      if (hit) return hit;
      try {
        const result = await this.processImage(value, {
          removeBackground: true,
        });
        if (this.config.provider !== 'none' && !result.backgroundRemoved) {
          allOk = false;
        }
        cache.set(value, result.dataUri);
        return result.dataUri;
      } catch (error) {
        allOk = false;
        this.logger.warn(
          `Product image processing failed, keeping original: ${(error as Error).message}`,
        );
        cache.set(value, value);
        return value;
      }
    };

    const out: T & { imageProcessed?: boolean } = { ...data };
    if (Array.isArray(data.images)) {
      out.images = [];
      for (const img of data.images) out.images.push(await convert(img));
    }
    if (typeof data.image === 'string') out.image = await convert(data.image);
    out.imageProcessed = allOk;
    return out;
  }
}
