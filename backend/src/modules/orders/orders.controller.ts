import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrderStatus, PaymentMethod } from './schemas/order.schema';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Post()
    async createOrder(
        @Request() req: any,
        @Body() body: {
            deliveryAddress: any;
            paymentMethod: PaymentMethod;
            deliveryInstructions?: string;
        },
    ) {
        const order = await this.ordersService.createOrder(req.user.userId, body);
        return { order };
    }

    @Get()
    async getUserOrders(
        @Request() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.ordersService.findByUser(
            req.user.userId,
            page ? parseInt(page) : 1,
            limit ? parseInt(limit) : 10,
        );
    }

    @Get(':id')
    async getOrder(@Request() req: any, @Param('id') id: string) {
        const order = await this.ordersService.findById(id);
        return { order };
    }

    @Get(':orderId/status')
    async getOrderStatus(@Param('orderId') orderId: string) {
        const status = await this.ordersService.getOrderStatus(orderId);
        return { orderId, status };
    }

    @Get(':orderId/history')
    async getStatusHistory(@Param('orderId') orderId: string) {
        const history = await this.ordersService.getStatusHistory(orderId);
        return { history };
    }
}

// Admin controller for order management
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    async getAllOrders(
        @Query('status') status?: OrderStatus,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.ordersService.findAll({
            status,
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            startDate,
            endDate,
        });
    }

    @Patch(':id/status')
    async updateOrderStatus(
        @Request() req: any,
        @Param('id') id: string,
        @Body() body: { status: OrderStatus; note?: string },
    ) {
        const order = await this.ordersService.updateStatus(
            id,
            body.status,
            req.user.userId,
            body.note,
        );
        return { order };
    }
}
