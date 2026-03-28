import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { ProductService } from './product.service';
import { CategoryService } from './category.service';
import { SearchService } from './search.service';

@Controller()
export class ProductGrpcController {
    constructor(
        private readonly productService: ProductService,
        private readonly categoryService: CategoryService,
        private readonly searchService: SearchService,
    ) {}

    @GrpcMethod('ProductService', 'GetProduct')
    async getProduct(data: { id: string }) {
        const product = await this.productService.findById(data.id);
        return { product };
    }

    @GrpcMethod('ProductService', 'GetProducts')
    async getProducts(data: {
        categoryId?: string;
        subcategoryId?: string;
        brandId?: string;
        page?: number;
        limit?: number;
        featured?: boolean;
    }) {
        return this.productService.findAll({
            categoryId: data.categoryId,
            subcategoryId: data.subcategoryId,
            brandId: data.brandId,
            page: data.page || 1,
            limit: data.limit || 20,
            isFeatured: data.featured,
        });
    }

    @GrpcMethod('ProductService', 'SearchProducts')
    async searchProducts(data: { query: string; page?: number; limit?: number }) {
        return this.searchService.search(data.query, data.page || 1, data.limit || 20);
    }

    @GrpcMethod('ProductService', 'GetFeaturedProducts')
    async getFeaturedProducts(data: { limit?: number }) {
        const products = await this.productService.getFeaturedProducts(data.limit || 10);
        return { products };
    }

    @GrpcMethod('ProductService', 'GetProductByBarcode')
    async getProductByBarcode(data: { barcode: string }) {
        const product = await this.productService.findByBarcode(data.barcode);
        if (!product) {
            return { found: false, barcode: data.barcode };
        }
        return { found: true, product };
    }

    @GrpcMethod('ProductService', 'CreateProduct')
    async createProduct(data: any) {
        const product = await this.productService.create(data);
        return { product };
    }

    @GrpcMethod('ProductService', 'UpdateProduct')
    async updateProduct(data: { id: string; data: any }) {
        const product = await this.productService.update(data.id, data.data);
        return { product };
    }

    @GrpcMethod('ProductService', 'DeleteProduct')
    async deleteProduct(data: { id: string }) {
        await this.productService.delete(data.id);
        return { success: true };
    }

    @GrpcMethod('ProductService', 'UpdateStock')
    async updateStock(data: { id: string; quantity: number }) {
        await this.productService.updateStock(data.id, data.quantity);
        return { success: true };
    }

    @GrpcMethod('CategoryService', 'GetCategories')
    async getCategories() {
        const categories = await this.categoryService.findAll();
        return { categories };
    }

    @GrpcMethod('CategoryService', 'GetCategoryTree')
    async getCategoryTree() {
        const tree = await this.categoryService.getCategoryTree();
        return { tree };
    }

    @GrpcMethod('CategoryService', 'GetCategory')
    async getCategory(data: { id: string }) {
        const category = await this.categoryService.findById(data.id);
        if (!category) {
            return { found: false, id: data.id };
        }
        return { found: true, category };
    }

    @GrpcMethod('CategoryService', 'CreateCategory')
    async createCategory(data: any) {
        const category = await this.categoryService.create(data);
        return { category };
    }

    @GrpcMethod('CategoryService', 'UpdateCategory')
    async updateCategory(data: { id: string; data: any }) {
        const category = await this.categoryService.update(data.id, data.data);
        return { category };
    }

    @GrpcMethod('CategoryService', 'DeleteCategory')
    async deleteCategory(data: { id: string }) {
        await this.categoryService.delete(data.id);
        return { success: true };
    }
}
