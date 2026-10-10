import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsImageSource } from './image-source.validator';

export class PreviewImageDto {
  /** Base64 image data URI (upload) or public http(s) URL. */
  @IsNotEmpty()
  @IsString()
  @IsImageSource()
  image!: string;

  @IsOptional()
  @IsBoolean()
  removeBackground?: boolean;
}
