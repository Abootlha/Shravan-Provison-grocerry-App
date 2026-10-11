import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { AdminProductsService } from './admin-products.service';
import {
  AdminProductsQueryDto,
  BulkStatusDto,
  ReorderLevelDto,
  StockAdjustmentDto,
  StockAdjustmentsQueryDto,
  UpdateProductStatusDto,
} from './dto/admin-products.dto';

/**
 * Admin catalogue + inventory. Managers can view and manage inventory;
 * changing a product's status (archive/draft) is admin-only.
 */
@Controller('admin/products')
@UseGuards(JwtAuthGuard, AdminGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class AdminProductsController {
  constructor(private readonly adminProducts: AdminProductsService) {}

  @Get()
  list(@Query() query: AdminProductsQueryDto) {
    return this.adminProducts.list(query);
  }

  @Get('counts')
  counts() {
    return this.adminProducts.counts();
  }

  @Post('bulk-status')
  @HttpCode(200)
  @Roles(UserRole.ADMIN)
  bulkStatus(@Body() body: BulkStatusDto) {
    return this.adminProducts.bulkSetStatus(body.ids, body.status);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return { product: await this.adminProducts.get(id) };
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  async setStatus(
    @Param('id') id: string,
    @Body() body: UpdateProductStatusDto,
  ) {
    return { product: await this.adminProducts.setStatus(id, body.status) };
  }

  @Patch(':id/reorder-level')
  async setReorderLevel(
    @Param('id') id: string,
    @Body() body: ReorderLevelDto,
  ) {
    return {
      product: await this.adminProducts.setReorderLevel(id, body.reorderLevel),
    };
  }

  @Post(':id/stock-adjustments')
  adjustStock(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: StockAdjustmentDto,
  ) {
    return this.adminProducts.adjustStock(id, body, {
      userId: req.user?.userId,
      role: req.user?.role,
    });
  }

  @Get(':id/stock-adjustments')
  listAdjustments(
    @Param('id') id: string,
    @Query() query: StockAdjustmentsQueryDto,
  ) {
    return this.adminProducts.listAdjustments(id, query.page, query.limit);
  }
}
