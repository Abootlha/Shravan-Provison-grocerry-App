import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignRiderDto } from './dto/assign-rider.dto';

@Controller('orders')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: CreateOrderDto) {
    return this.orderService.createOrder(dto);
  }

  @Get(':orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.orderService.getOrderById(orderId);
  }

  @Get('user/:userId')
  async getOrdersByUser(@Param('userId') userId: string) {
    return this.orderService.getOrdersByUserId(userId);
  }

  @Get('rider/:riderId')
  async getOrdersByRider(@Param('riderId') riderId: string) {
    return this.orderService.getOrdersByRiderId(riderId);
  }

  @Get()
  async getActiveOrders() {
    return this.orderService.getActiveOrders();
  }

  @Patch('status')
  async updateStatus(@Body() dto: UpdateStatusDto) {
    return this.orderService.updateStatus(dto);
  }

  @Patch('assign-rider')
  async assignRider(@Body() dto: AssignRiderDto) {
    return this.orderService.assignRider(dto);
  }

  @Post(':orderId/cancel')
  async cancelOrder(
    @Param('orderId') orderId: string,
    @Body('reason') reason: string,
    @Body('cancelledBy') cancelledBy?: string,
  ) {
    return this.orderService.cancelOrder(orderId, reason, cancelledBy);
  }
}
