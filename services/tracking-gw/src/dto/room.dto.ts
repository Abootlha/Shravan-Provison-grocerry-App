import { IsString } from 'class-validator';

export class JoinOrderRoomDto {
  @IsString()
  orderId!: string;
}

export class LeaveOrderRoomDto {
  @IsString()
  orderId!: string;
}
