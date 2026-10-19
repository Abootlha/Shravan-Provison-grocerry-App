import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddToCartDto, UpdateCartItemDto } from './dto/cart.dto';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  async addToCart(@Request() req: any, @Body() body: AddToCartDto) {
    return this.cartService.addToCart(
      req.user.userId,
      body.productId,
      body.quantity || 1,
      body.variantSku,
    );
  }

  @Put('update')
  async updateQuantity(@Request() req: any, @Body() body: UpdateCartItemDto) {
    return this.cartService.updateQuantity(
      req.user.userId,
      body.productId,
      body.quantity,
      body.variantSku,
    );
  }

  @Delete('remove/:productId')
  async removeFromCart(
    @Request() req: any,
    @Param('productId') productId: string,
    @Query('variantSku') variantSku?: string,
  ) {
    return this.cartService.removeFromCart(
      req.user.userId,
      productId,
      typeof variantSku === 'string' ? variantSku.slice(0, 100) : undefined,
    );
  }

  @Delete('clear')
  async clearCart(@Request() req: any) {
    await this.cartService.clearCart(req.user.userId);
    return { message: 'Cart cleared' };
  }
}
