import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart-item.dto';

@Controller('cart')
export class CartController {
    constructor(private readonly cartService: CartService) {}

    @Get(':userId')
    async getCart(@Param('userId') userId: string) {
        const cart = await this.cartService.getCart(userId);
        return { cart };
    }

    @Post(':userId/items')
    async addItem(
        @Param('userId') userId: string,
        @Body() data: AddCartItemDto,
    ) {
        const cart = await this.cartService.addItem(userId, data);
        return { cart };
    }

    @Put(':userId/items/:productId')
    async updateItemQuantity(
        @Param('userId') userId: string,
        @Param('productId') productId: string,
        @Body() data: UpdateCartItemDto,
    ) {
        const cart = await this.cartService.updateItemQuantity(userId, productId, data);
        return { cart };
    }

    @Delete(':userId/items/:productId')
    async removeItem(
        @Param('userId') userId: string,
        @Param('productId') productId: string,
    ) {
        const cart = await this.cartService.removeItem(userId, productId);
        return { cart };
    }

    @Delete(':userId')
    async clearCart(@Param('userId') userId: string) {
        const result = await this.cartService.clearCart(userId);
        return result;
    }

    @Post(':userId/recalculate')
    async recalculateCart(@Param('userId') userId: string) {
        const cart = await this.cartService.recalculateCart(userId);
        return { cart };
    }

    @Post(':userId/validate-stock')
    async validateStock(
        @Param('userId') userId: string,
        @Body() products: { productId: string; quantity: number; stock: number }[],
    ) {
        const result = await this.cartService.validateStock(userId, products);
        return result;
    }
}
