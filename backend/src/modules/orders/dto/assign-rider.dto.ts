import { IsMongoId } from 'class-validator';

export class AssignRiderDto {
  @IsMongoId()
  riderId!: string;
}
