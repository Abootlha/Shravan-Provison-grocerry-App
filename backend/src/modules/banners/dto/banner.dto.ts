import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { BannerTargetType } from '../schemas/banner.schema';

const HTTPS_URL = {
  protocols: ['https'],
  require_protocol: true,
};

export class BannerTargetDto {
  @IsEnum(BannerTargetType)
  type!: BannerTargetType;

  /** Required when type is category or product. */
  @ValidateIf((o: BannerTargetDto) => o.type !== BannerTargetType.URL)
  @IsMongoId()
  id?: string;

  /** Required (https) when type is url. */
  @ValidateIf((o: BannerTargetDto) => o.type === BannerTargetType.URL)
  @IsUrl(HTTPS_URL, { message: 'url must be an https URL' })
  @MaxLength(2000)
  url?: string;
}

export class CreateBannerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleHi?: string;

  @IsUrl(HTTPS_URL, { message: 'image must be an https URL' })
  @MaxLength(2000)
  image!: string;

  @ValidateNested()
  @Type(() => BannerTargetDto)
  target!: BannerTargetDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  /** ISO date-time; null clears it. */
  @IsOptional()
  @ValidateIf((o: CreateBannerDto) => o.startsAt !== null)
  @IsDateString()
  startsAt?: string | null;

  /** ISO date-time; null clears it. */
  @IsOptional()
  @ValidateIf((o: CreateBannerDto) => o.endsAt !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  titleHi?: string;

  @IsOptional()
  @IsUrl(HTTPS_URL, { message: 'image must be an https URL' })
  @MaxLength(2000)
  image?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BannerTargetDto)
  target?: BannerTargetDto;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @ValidateIf((o: UpdateBannerDto) => o.startsAt !== null)
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @ValidateIf((o: UpdateBannerDto) => o.endsAt !== null)
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** New order: banner ids from first to last; sortOrder becomes the index. */
export class ReorderBannersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids!: string[];
}
