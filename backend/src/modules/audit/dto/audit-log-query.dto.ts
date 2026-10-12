import {
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

/** GET /admin/audit-log. `q` searches the summary text. */
export class AuditLogQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsMongoId()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
