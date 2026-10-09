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
} from '@nestjs/common';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  async getCart(@Request() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  async addToCart(
    @Request() req: any,
    @Body() body: { productId: string; quantity?: number },
  ) {
    return this.cartService.addToCart(
      req.user.userId,
      body.productId,
      body.quantity || 1,
    );
  }

  @Put('update')
  async updateQuantity(
    @Request() req: any,
    @Body() body: { productId: string; quantity: number },
  ) {
    return this.cartService.updateQuantity(
      req.user.userId,
      body.productId,
      body.quantity,
    );
  }

  @Delete('remove/:productId')
  async removeFromCart(
    @Request() req: any,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeFromCart(req.user.userId, productId);
  }

  @Delete('clear')
  async clearCart(@Request() req: any) {
    await this.cartService.clearCart(req.user.userId);
    return { message: 'Cart cleared' };
  }
}
