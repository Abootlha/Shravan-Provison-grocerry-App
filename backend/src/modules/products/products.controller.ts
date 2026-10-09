import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { BarcodeService } from './barcode.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { Types } from 'mongoose';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 100;

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly barcodeService: BarcodeService,
  ) {}

  @Get()
  async findAll(
    @Query('categoryId') categoryId?: string,
    @Query('subcategoryId') subcategoryId?: string,
    @Query('itemGroupId') itemGroupId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll({
      categoryId,
      subcategoryId,
      itemGroupId,
      page: Math.min(parsePositiveInt(page, 1), 10_000),
      limit: Math.min(
        parsePositiveInt(limit, DEFAULT_PAGE_SIZE),
        MAX_PAGE_SIZE,
      ),
      search:
        typeof search === 'string'
          ? search.slice(0, MAX_SEARCH_LENGTH)
          : undefined,
    });
  }

  @Get('barcode/:barcode')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async lookupBarcode(@Param('barcode') barcode: string) {
    if (!/^[0-9]{8,14}$/.test(barcode)) {
      throw new BadRequestException('Barcode must be 8-14 digits');
    }
    const data = await this.barcodeService.lookupBarcode(barcode);
    return data;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const product = await this.productsService.findById(id);
    return { product };
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  async create(@Body() data: CreateProductDto) {
    const productData: any = {
      ...data,
      categoryId: new Types.ObjectId(data.categoryId),
      subcategoryId: new Types.ObjectId(data.subcategoryId),
      itemGroupId: new Types.ObjectId(data.itemGroupId),
    };
    // Ensure nutrition has servingSize if provided
    if (productData.nutrition && !productData.nutrition.servingSize) {
      productData.nutrition.servingSize = '100g';
    }
    const product = await this.productsService.create(productData);
    return { product };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async update(@Param('id') id: string, @Body() data: UpdateProductDto) {
    const productData: any = { ...data };
    if (data.categoryId) {
      productData.categoryId = new Types.ObjectId(data.categoryId);
    }
    if (data.subcategoryId) {
      productData.subcategoryId = new Types.ObjectId(data.subcategoryId);
    }
    if (data.itemGroupId) {
      productData.itemGroupId = new Types.ObjectId(data.itemGroupId);
    }
    // Ensure nutrition has servingSize if provided
    if (productData.nutrition && !productData.nutrition.servingSize) {
      productData.nutrition.servingSize = '100g';
    }
    const product = await this.productsService.update(id, productData);
    return { product };
  }

  @Put(':id/stock')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateStock(@Param('id') id: string, @Body() data: UpdateStockDto) {
    await this.productsService.updateStock(id, data.quantity);
    return { message: 'Stock updated' };
  }
}
