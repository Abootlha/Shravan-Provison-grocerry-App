import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './product.schema';
import { Category, CategorySchema } from './category.schema';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { ProductGrpcController } from './product.grpc.controller';
import { CategoryService } from './category.service';
import { SearchService } from './search.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Product.name, schema: ProductSchema },
            { name: Category.name, schema: CategorySchema },
        ]),
    ],
    controllers: [ProductController, ProductGrpcController],
    providers: [ProductService, CategoryService, SearchService],
    exports: [ProductService, CategoryService, SearchService],
})
export class ProductModule {}
