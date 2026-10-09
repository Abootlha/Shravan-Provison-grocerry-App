import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignRiderDto } from './dto/assign-rider.dto';

@Controller()
export class OrderGrpcController {
  constructor(private readonly orderService: OrderService) {}

  @GrpcMethod('OrderService', 'CreateOrder')
  async createOrder(data: CreateOrderDto) {
    return this.orderService.createOrder(data);
  }

  @GrpcMethod('OrderService', 'GetOrder')
  async getOrder(data: { orderId: string }) {
    return this.orderService.getOrderById(data.orderId);
  }

  @GrpcMethod('OrderService', 'GetOrdersByUser')
  async getOrdersByUser(data: { userId: string }) {
    return { orders: await this.orderService.getOrdersByUserId(data.userId) };
  }

  @GrpcMethod('OrderService', 'GetOrdersByRider')
  async getOrdersByRider(data: { riderId: string }) {
    return { orders: await this.orderService.getOrdersByRiderId(data.riderId) };
  }

  @GrpcMethod('OrderService', 'GetActiveOrders')
  async getActiveOrders() {
    return { orders: await this.orderService.getActiveOrders() };
  }

  @GrpcMethod('OrderService', 'UpdateStatus')
  async updateStatus(data: { orderId: string; newStatus: string; note?: string; changedBy?: string }) {
    const dto: UpdateStatusDto = {
      orderId: data.orderId,
      newStatus: data.newStatus as any,
      note: data.note,
      changedBy: data.changedBy,
    };
    return this.orderService.updateStatus(dto);
  }

  @GrpcMethod('OrderService', 'AssignRider')
  async assignRider(data: { orderId: string; riderId: string }) {
    const dto: AssignRiderDto = {
      orderId: data.orderId,
      riderId: data.riderId,
    };
    return this.orderService.assignRider(dto);
  }

  @GrpcMethod('OrderService', 'CancelOrder')
  async cancelOrder(data: { orderId: string; reason: string; cancelledBy?: string }) {
    return this.orderService.cancelOrder(data.orderId, data.reason, data.cancelledBy);
  }
}
