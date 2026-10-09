import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class AssignRiderDto {
  @IsNotEmpty()
  @IsString()
  orderId: string;

  @IsNotEmpty()
  @IsString()
  riderId: string;

  @IsOptional()
  @IsString()
  assignedBy?: string;
}
