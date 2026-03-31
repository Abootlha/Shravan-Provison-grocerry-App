import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrderStatus, PaymentMethod } from './schemas/order.schema';
import { UpdateStatusDto, AssignRiderDto } from './dto';
import { UserRole } from '../users/schemas/user.schema';

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
            items?: any[];
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

    @Get('available')
    async getAvailableOrders(@Request() req: any) {
        if (req.user.role !== UserRole.RIDER) {
            throw new ForbiddenException('Only riders can access available orders');
        }

        const orders = await this.ordersService.findAvailableForRiders();
        return { orders };
    }

    @Patch(':id/accept')
    async acceptOrder(@Request() req: any, @Param('id') id: string) {
        if (req.user.role !== UserRole.RIDER) {
            throw new ForbiddenException('Only riders can accept orders');
        }

        const order = await this.ordersService.assignRider(id, req.user.userId);
        return { order };
    }

    @Get('user/:userId')
    async getOrdersByUserId(
        @Request() req: any,
        @Param('userId') userId: string,
    ) {
        // Verify ownership or admin role
        if (req.user.userId !== userId && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('You can only access your own orders');
        }

        const orders = await this.ordersService.findByUserId(userId);
        return { orders };
    }

    @Get(':id')
    async getOrder(@Request() req: any, @Param('id') id: string) {
        const order = await this.ordersService.findById(id);

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Verify ownership or admin role
        if (order.userId.toString() !== req.user.userId && req.user.role !== UserRole.ADMIN) {
            throw new ForbiddenException('You can only access your own orders');
        }

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

    @Patch(':id/status')
    async updateOrderStatus(
        @Request() req: any,
        @Param('id') id: string,
        @Body() updateStatusDto: UpdateStatusDto,
    ) {
        const order = await this.ordersService.findById(id);

        if (!order) {
            throw new NotFoundException('Order not found');
        }

        // Role-based authorization
        // Riders can only update their assigned orders
        if (req.user.role === UserRole.RIDER) {
            if (!order.riderId || order.riderId.toString() !== req.user.userId) {
                throw new ForbiddenException('You can only update orders assigned to you');
            }
        }
        // Customers cannot update order status
        else if (req.user.role === UserRole.CUSTOMER) {
            throw new ForbiddenException('Customers cannot update order status');
        }
        else if (req.user.role === UserRole.ADMIN && updateStatusDto.status === OrderStatus.OUT_FOR_DELIVERY) {
            throw new ForbiddenException('Admins cannot mark orders as out for delivery');
        }

        const updatedOrder = await this.ordersService.updateStatus(
            id,
            updateStatusDto.status,
            req.user.userId,
        );

        return { order: updatedOrder };
    }

    @Patch(':id/assign-rider')
    @UseGuards(AdminGuard)
    async assignRider(
        @Param('id') id: string,
        @Body() assignRiderDto: AssignRiderDto,
    ) {
        const order = await this.ordersService.assignRider(id, assignRiderDto.riderId);
        return { order };
    }
}

// Admin controller for order management
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminOrdersController {
    constructor(private readonly ordersService: OrdersService) { }

    @Get()
    async getAllOrders(
        @Query('status') status?: string,
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
        if (body.status === OrderStatus.OUT_FOR_DELIVERY) {
            throw new ForbiddenException('Admins cannot mark orders as out for delivery');
        }

        const order = await this.ordersService.updateStatus(
            id,
            body.status,
            req.user.userId,
        );
        return { order };
    }
}
