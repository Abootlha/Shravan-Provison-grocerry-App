import { IsInt, Max, Min } from 'class-validator';

export class UpdateStockDto {
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  quantity!: number;
}
