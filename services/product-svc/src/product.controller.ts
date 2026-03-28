import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CategoryService } from './category.service';
import { SearchService } from './search.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

@Controller()
export class ProductController {
    constructor(
        private readonly productService: ProductService,
        private readonly categoryService: CategoryService,
        private readonly searchService: SearchService,
    ) {}

    @Get('products')
    async getProducts(
        @Query('categoryId') categoryId?: string,
        @Query('subcategoryId') subcategoryId?: string,
        @Query('brandId') brandId?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('featured') featured?: string,
    ) {
        const isFeatured = featured === 'true' ? true : featured === 'false' ? false : undefined;
        return this.productService.findAll({
            categoryId,
            subcategoryId,
            brandId,
            page: page ? parseInt(page, 10) : 1,
            limit: limit ? parseInt(limit, 10) : 20,
            search,
            isFeatured,
        });
    }

    @Get('products/featured')
    async getFeaturedProducts(@Query('limit') limit?: string) {
        return this.productService.getFeaturedProducts(limit ? parseInt(limit, 10) : 10);
    }

    @Get('products/barcode/:barcode')
    async lookupBarcode(@Param('barcode') barcode: string) {
        const product = await this.productService.findByBarcode(barcode);
        if (!product) {
            return { found: false, barcode };
        }
        return { found: true, product };
    }

    @Get('products/search')
    async searchProducts(
        @Query('q') query?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        if (!query) {
            return { products: [], total: 0, page: 1, limit: 20, totalPages: 0 };
        }
        return this.searchService.search(
            query,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 20,
        );
    }

    @Get('products/:id')
    async getProduct(@Param('id') id: string) {
        const product = await this.productService.findById(id);
        if (!product) {
            return { found: false, id };
        }
        return { found: true, product };
    }

    @Post('products')
    async createProduct(@Body() data: CreateProductDto) {
        const product = await this.productService.create(data);
        return { product };
    }

    @Put('products/:id')
    async updateProduct(@Param('id') id: string, @Body() data: UpdateProductDto) {
        const product = await this.productService.update(id, data);
        return { product };
    }

    @Delete('products/:id')
    async deleteProduct(@Param('id') id: string) {
        await this.productService.delete(id);
        return { message: 'Product deleted successfully' };
    }

    @Put('products/:id/stock')
    async updateStock(@Param('id') id: string, @Body() data: { quantity: number }) {
        await this.productService.updateStock(id, data.quantity);
        return { message: 'Stock updated successfully' };
    }

    @Get('categories')
    async getCategories() {
        const categories = await this.categoryService.findAll();
        return { categories };
    }

    @Get('categories/tree')
    async getCategoryTree() {
        const tree = await this.categoryService.getCategoryTree();
        return { tree };
    }

    @Get('categories/:id')
    async getCategory(@Param('id') id: string) {
        const category = await this.categoryService.findById(id);
        if (!category) {
            return { found: false, id };
        }
        return { found: true, category };
    }

    @Get('categories/:id/subcategories')
    async getSubcategories(@Param('id') id: string) {
        const subcategories = await this.categoryService.findSubcategories(id);
        return { subcategories };
    }

    @Post('categories')
    async createCategory(@Body() data: CreateCategoryDto) {
        const category = await this.categoryService.create(data);
        return { category };
    }

    @Put('categories/:id')
    async updateCategory(@Param('id') id: string, @Body() data: UpdateCategoryDto) {
        const category = await this.categoryService.update(id, data);
        return { category };
    }

    @Delete('categories/:id')
    async deleteCategory(@Param('id') id: string) {
        await this.categoryService.delete(id);
        return { message: 'Category deleted successfully' };
    }
}
