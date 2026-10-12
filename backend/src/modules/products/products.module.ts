import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  StockAdjustment,
  StockAdjustmentSchema,
} from './schemas/stock-adjustment.schema';
import { AdminProductsService } from './admin-products.service';
import { AdminProductsController } from './admin-products.controller';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { BarcodeService } from './barcode.service';
import { HierarchyValidator } from './validators/hierarchy.validator';
import { ImageProcessingService } from './image-processing/image-processing.service';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import {
  Subcategory,
  SubcategorySchema,
} from '../subcategories/schemas/subcategory.schema';
import {
  ItemGroup,
  ItemGroupSchema,
} from '../item-groups/schemas/item-group.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: StockAdjustment.name, schema: StockAdjustmentSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
      { name: ItemGroup.name, schema: ItemGroupSchema },
    ]),
  ],
  controllers: [ProductsController, AdminProductsController],
  providers: [
    ProductsService,
    BarcodeService,
    HierarchyValidator,
    ImageProcessingService,
    AdminProductsService,
  ],
  exports: [ProductsService, BarcodeService, ImageProcessingService],
})
export class ProductsModule {}
