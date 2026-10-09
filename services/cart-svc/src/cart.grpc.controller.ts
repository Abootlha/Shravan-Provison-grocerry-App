import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto, CartResponse } from './dto/cart-item.dto';

@Controller()
export class CartGrpcController {
    constructor(private readonly cartService: CartService) {}

    @GrpcMethod('CartService', 'GetCart')
    async getCart(data: { userId: string }): Promise<CartResponse> {
        return this.cartService.getCart(data.userId);
    }

    @GrpcMethod('CartService', 'AddItem')
    async addItem(data: { userId: string; item: AddCartItemDto }): Promise<CartResponse> {
        return this.cartService.addItem(data.userId, data.item);
    }

    @GrpcMethod('CartService', 'UpdateItemQuantity')
    async updateItemQuantity(
        data: { userId: string; productId: string; quantity: number },
    ): Promise<CartResponse> {
        return this.cartService.updateItemQuantity(data.userId, data.productId, {
            quantity: data.quantity,
        });
    }

    @GrpcMethod('CartService', 'RemoveItem')
    async removeItem(data: { userId: string; productId: string }): Promise<CartResponse> {
        return this.cartService.removeItem(data.userId, data.productId);
    }

    @GrpcMethod('CartService', 'ClearCart')
    async clearCart(data: { userId: string }) {
        return this.cartService.clearCart(data.userId);
    }

    @GrpcMethod('CartService', 'RecalculateCart')
    async recalculateCart(data: { userId: string }): Promise<CartResponse> {
        return this.cartService.recalculateCart(data.userId);
    }

    @GrpcMethod('CartService', 'ValidateStock')
    async validateStock(
        data: { userId: string; products: { productId: string; quantity: number; stock: number }[] },
    ) {
        return this.cartService.validateStock(data.userId, data.products);
    }
}
