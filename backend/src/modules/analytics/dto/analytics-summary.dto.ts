import { IsDateString, IsOptional } from 'class-validator';

/**
 * from/to: YYYY-MM-DD (store-local calendar days, inclusive) or an ISO
 * timestamp (its local date is used). Default: the last 7 days.
 */
export class AnalyticsSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
