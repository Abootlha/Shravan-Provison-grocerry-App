import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './schemas/product.schema';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { BarcodeService } from './barcode.service';
import { HierarchyValidator } from './validators/hierarchy.validator';
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
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
      { name: ItemGroup.name, schema: ItemGroupSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, BarcodeService, HierarchyValidator],
  exports: [ProductsService, BarcodeService],
})
export class ProductsModule {}
