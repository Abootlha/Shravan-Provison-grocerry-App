import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

/** Max pack sizes on one product. */
export const MAX_VARIANTS = 20;

/** One pack size (ProductVariant) as the admin editor sends it. */
export class ProductVariantDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w./-]+$/, {
    message: 'variant sku may only use letters, digits, . _ / -',
  })
  sku!: string;

  @IsString()
  @MaxLength(50)
  @Matches(/\S/, { message: 'variant unit is required' })
  unit!: string;

  @IsNumber()
  @Min(0.01)
  mrp!: number;

  @IsNumber()
  @Min(0.01)
  sellingPrice!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  stock!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  barcode?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** SKUs unique within the product, selling price never above MRP, at most one default. */
@ValidatorConstraint({ name: 'validVariants', async: false })
export class ValidVariantsConstraint implements ValidatorConstraintInterface {
  private reason = '';

  validate(variants: unknown): boolean {
    if (variants === undefined) return true;
    if (!Array.isArray(variants)) return true; // @IsArray reports it
    const skus = new Set<string>();
    let defaults = 0;
    for (const v of variants as ProductVariantDto[]) {
      if (!v || typeof v !== 'object') continue;
      if (typeof v.sku === 'string') {
        const key = v.sku.trim().toLowerCase();
        if (skus.has(key)) {
          this.reason = `Duplicate variant sku "${v.sku}"`;
          return false;
        }
        skus.add(key);
      }
      if (
        typeof v.mrp === 'number' &&
        typeof v.sellingPrice === 'number' &&
        v.sellingPrice > v.mrp
      ) {
        this.reason = `Variant "${v.sku}" sells above its MRP`;
        return false;
      }
      if (v.isDefault) defaults += 1;
    }
    if (defaults > 1) {
      this.reason = 'Only one variant can be the default';
      return false;
    }
    return true;
  }

  defaultMessage(): string {
    return this.reason || 'Invalid variants';
  }
}

/**
 * Normalises variants before they are stored: trims, marks exactly one default (the
 * flagged one, else the first active, else the first) and returns the fields the product's
 * own price / unit / stock should mirror (product.schema pre-save does the same on create).
 */
export function normalizeVariants(variants: ProductVariantDto[]): {
  variants: any[];
  mirror: Record<string, any> | null;
} {
  if (!variants.length) return { variants: [], mirror: null };
  const list = variants.map((v) => ({
    ...v,
    sku: v.sku.trim(),
    unit: v.unit.trim(),
    isActive: v.isActive !== false,
    isDefault: !!v.isDefault,
  }));
  const def =
    list.find((v) => v.isDefault) || list.find((v) => v.isActive) || list[0];
  list.forEach((v) => {
    v.isDefault = v === def;
  });
  return {
    variants: list,
    mirror: {
      price: def.sellingPrice,
      originalPrice: def.mrp,
      unit: def.unit,
      stock: def.stock,
      'pricing.sellingPrice': def.sellingPrice,
      'pricing.mrp': def.mrp,
      'pack.unit': def.unit,
    },
  };
}
