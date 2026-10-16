import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ScrapedProduct,
  ScrapedProductSchema,
} from './schemas/scraped-product.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
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
import { ProductsModule } from '../products/products.module';
import { R2StorageService } from '../../common/storage/r2-storage.service';
import { SCRAPE_QUEUE, ScraperService } from './scraper.service';
import { ScrapeProcessor } from './scraper.processor';
import { ScraperController } from './scraper.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ScrapedProduct.name, schema: ScrapedProductSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Subcategory.name, schema: SubcategorySchema },
      { name: ItemGroup.name, schema: ItemGroupSchema },
    ]),
    BullModule.registerQueue({ name: SCRAPE_QUEUE }),
    ProductsModule,
  ],
  controllers: [ScraperController],
  providers: [ScraperService, ScrapeProcessor, R2StorageService],
})
export class ScraperModule {}
