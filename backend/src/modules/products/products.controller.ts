import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService, PaginatedProducts } from './products.service';
import { BarcodeService } from './barcode.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Types } from 'mongoose';

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
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      search,
    });
  }

  @Get('barcode/:barcode')
  async lookupBarcode(@Param('barcode') barcode: string) {
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
  async updateStock(
    @Param('id') id: string,
    @Body() data: { quantity: number },
  ) {
    await this.productsService.updateStock(id, data.quantity);
    return { message: 'Stock updated' };
  }
}
