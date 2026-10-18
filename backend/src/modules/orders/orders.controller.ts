import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
  NotFoundException,
  HttpCode,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { OrderStatus } from './schemas/order.schema';
import {
  CreateOrderDto,
  UpdateStatusDto,
  AdminUpdateStatusDto,
  AssignRiderDto,
  QuoteOrderDto,
  AdminOrdersQueryDto,
  RejectOrderDto,
} from './dto';
import { UserRole, isStaffRole } from '../users/schemas/user.schema';
import { Roles } from '../auth/decorators/roles.decorator';

// Statuses only the assigned rider may set.
const RIDER_CONTROLLED_STATUSES = [
  OrderStatus.ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  private extractEntityId(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (
      typeof value.toString === 'function' &&
      value.constructor?.name === 'ObjectId'
    ) {
      return value.toString();
    }
    if (value._id) {
      return typeof value._id === 'string'
        ? value._id
        : value._id?.toString?.() || null;
    }
    if (value.id) {
      return typeof value.id === 'string'
        ? value.id
        : value.id?.toString?.() || null;
    }
    return value?.toString?.() || null;
  }

  /**
   * Loads an order by its human-readable orderId and ensures the caller is the
   * owning customer, the assigned rider, or an admin.
   */
  private async assertOrderAccess(req: any, orderId: string) {
    const order = await this.ordersService.findAccessInfoByOrderId(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const isOwner = this.extractEntityId(order.userId) === req.user.userId;
    const isAssignedRider =
      req.user.role === UserRole.RIDER &&
      this.extractEntityId(order.riderId) === req.user.userId;
    const isAdmin = isStaffRole(req.user.role);

    if (!isOwner && !isAssignedRider && !isAdmin) {
      throw new ForbiddenException('You can only access your own orders');
    }

    return { order, isAdmin };
  }

  /**
   * POST /orders. 409 { code: 'STORE_CLOSED', nextOpenAt } when the store is
   * closed or outside storeTimings.
   */
  @Post()
  async createOrder(@Request() req: any, @Body() body: CreateOrderDto) {
    const order = await this.ordersService.createOrder(req.user.userId, body);
    return { order };
  }

  /** POST /orders/quote: the exact bill POST /orders would charge. */
  @Post('quote')
  @HttpCode(200)
  async quoteOrder(@Request() req: any, @Body() body: QuoteOrderDto) {
    return this.ordersService.quoteOrder(req.user.userId, body.items);
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

    const orders = await this.ordersService.findAvailableForRiders(
      req.user.userId,
    );
    return { orders };
  }

  @Get('current')
  async getCurrentRiderOrder(@Request() req: any) {
    if (req.user.role !== UserRole.RIDER) {
      throw new ForbiddenException(
        'Only riders can access active rider orders',
      );
    }

    const order = await this.ordersService.findCurrentForRider(req.user.userId);
    return { order };
  }

  @Patch(':id/accept')
  async acceptOrder(@Request() req: any, @Param('id') id: string) {
    if (req.user.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only riders can accept orders');
    }

    const order = await this.ordersService.riderAcceptOrder(
      id,
      req.user.userId,
    );
    return { order };
  }

  /**
   * Rider hands back an order reserved for them (CONFIRMED) or accepted but
   * not yet packed (ASSIGNED). The order is offered to another rider.
   */
  @Patch(':id/reject')
  async rejectOrder(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: RejectOrderDto,
  ) {
    if (req.user.role !== UserRole.RIDER) {
      throw new ForbiddenException('Only riders can reject orders');
    }

    return this.ordersService.riderRejectOrder(
      id,
      req.user.userId,
      body?.reason,
    );
  }

  @Get('user/:userId')
  async getOrdersByUserId(
    @Request() req: any,
    @Param('userId') userId: string,
  ) {
    // Verify ownership or admin role
    if (req.user.userId !== userId && !isStaffRole(req.user.role)) {
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

    const isOwner = this.extractEntityId(order.userId) === req.user.userId;
    const isAssignedRider =
      this.extractEntityId(order.riderId) === req.user.userId;

    // Verify ownership, assigned rider, or admin role
    if (!isOwner && !isAssignedRider && !isStaffRole(req.user.role)) {
      throw new ForbiddenException('You can only access your own orders');
    }

    // Only the owning customer may see the delivery OTP.
    const trackingOrder = await this.ordersService.getTrackingOrderById(id, {
      includeDeliveryOtp: isOwner,
    });
    return { order: trackingOrder };
  }

  @Get(':orderId/status')
  async getOrderStatus(@Request() req: any, @Param('orderId') orderId: string) {
    await this.assertOrderAccess(req, orderId);
    const status = await this.ordersService.getOrderStatus(orderId);
    return { orderId, status };
  }

  @Get(':orderId/history')
  async getStatusHistory(
    @Request() req: any,
    @Param('orderId') orderId: string,
  ) {
    const { isAdmin } = await this.assertOrderAccess(req, orderId);
    const history = await this.ordersService.getStatusHistory(orderId);

    if (isAdmin) {
      return { history };
    }

    // Non-admins don't get the ids of the staff/riders who changed the status.
    return {
      history: history.map((entry: any) => ({
        previousStatus: entry.previousStatus ?? null,
        newStatus: entry.newStatus,
        note: entry.note,
        createdAt: entry.createdAt,
      })),
    };
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
      if (this.extractEntityId(order.riderId) !== req.user.userId) {
        throw new ForbiddenException(
          'You can only update orders assigned to you',
        );
      }

      const riderAllowedStatuses = [
        OrderStatus.PICKED_UP,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
      ];
      if (!riderAllowedStatuses.includes(updateStatusDto.status)) {
        throw new ForbiddenException(
          'Riders can only update pickup, delivery, or cancellation statuses',
        );
      }

      if (
        updateStatusDto.status === OrderStatus.CANCELLED &&
        [OrderStatus.PICKED_UP, OrderStatus.OUT_FOR_DELIVERY].includes(
          order.orderStatus,
        )
      ) {
        throw new ForbiddenException(
          'Riders cannot cancel an order after pickup. Contact the store.',
        );
      }
    }
    // Customers cannot update order status
    else if (req.user.role === UserRole.CUSTOMER) {
      throw new ForbiddenException('Customers cannot update order status');
    } else if (
      isStaffRole(req.user.role) &&
      RIDER_CONTROLLED_STATUSES.includes(updateStatusDto.status)
    ) {
      throw new ForbiddenException(
        'Admins cannot update rider-controlled delivery statuses',
      );
    }

    const updatedOrder = await this.ordersService.updateStatus(
      id,
      updateStatusDto.status,
      req.user.userId,
      {
        actorRole: req.user.role,
        deliveryOtp: updateStatusDto.deliveryOtp,
        location:
          req.user.role === UserRole.RIDER
            ? updateStatusDto.location
            : undefined,
      },
    );

    return { order: updatedOrder };
  }

  @Patch(':id/assign-rider')
  @UseGuards(AdminGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async assignRider(
    @Param('id') id: string,
    @Body() assignRiderDto: AssignRiderDto,
  ) {
    const order = await this.ordersService.assignRider(
      id,
      assignRiderDto.riderId,
    );
    return { order };
  }
}

// Admin controller for order management (admins and managers).
@Controller('admin/orders')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminOrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  async getAllOrders(@Query() query: AdminOrdersQueryDto) {
    return this.ordersService.adminListOrders(query);
  }

  /** :id is the Mongo _id or the human orderId (ORD-...). */
  @Get(':id')
  async getOrderDetail(@Param('id') id: string) {
    const order = await this.ordersService.adminGetOrderDetail(id);
    return { order };
  }

  @Patch(':id/status')
  async updateOrderStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: AdminUpdateStatusDto,
  ) {
    if (RIDER_CONTROLLED_STATUSES.includes(body.status)) {
      throw new ForbiddenException(
        'Admins cannot update rider-controlled delivery statuses',
      );
    }

    const order = await this.ordersService.updateStatus(
      id,
      body.status,
      req.user.userId,
      { actorRole: req.user.role, reason: body.note },
    );
    return { order };
  }

  /** Only CONFIRMED orders; the rider must be active and available. */
  @Patch(':id/assign-rider')
  async assignRider(@Param('id') id: string, @Body() body: AssignRiderDto) {
    const order = await this.ordersService.assignRider(id, body.riderId);
    return { order };
  }

  /** Only while CONFIRMED (before the rider accepted). */
  @Patch(':id/unassign-rider')
  async unassignRider(@Param('id') id: string) {
    const order = await this.ordersService.unassignRider(id);
    return { order };
  }
}
