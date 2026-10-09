import { Injectable } from '@nestjs/common';
import { CartDocument } from './cart.schema';

export interface PriceCalculation {
    subtotal: number;
    itemCount: number;
    savings: number;
    total: number;
}

export interface CartItemPrice {
    productId: string;
    quantity: number;
    price: number;
    originalPrice: number;
    lineTotal: number;
    savings: number;
}

@Injectable()
export class PriceCalculatorService {
    calculateCartPrices(cart: CartDocument): PriceCalculation {
        let subtotal = 0;
        let itemCount = 0;
        let savings = 0;

        for (const item of cart.items) {
            const lineTotal = item.price * item.quantity;
            subtotal += lineTotal;
            itemCount += item.quantity;
        }

        return {
            subtotal: Math.round(subtotal * 100) / 100,
            itemCount,
            savings: Math.round(savings * 100) / 100,
            total: Math.round((subtotal - savings) * 100) / 100,
        };
    }

    calculateLineItemPrice(
        price: number,
        mrp: number,
        quantity: number,
    ): CartItemPrice {
        const lineTotal = price * quantity;
        const originalTotal = mrp * quantity;
        const savings = originalTotal - lineTotal;

        return {
            productId: '',
            quantity,
            price,
            originalPrice: mrp,
            lineTotal: Math.round(lineTotal * 100) / 100,
            savings: Math.round(savings * 100) / 100,
        };
    }

    validateStock(
        requestedQuantity: number,
        availableStock: number,
    ): { valid: boolean; message?: string } {
        if (requestedQuantity <= 0) {
            return { valid: false, message: 'Quantity must be at least 1' };
        }
        if (requestedQuantity > availableStock) {
            return {
                valid: false,
                message: `Only ${availableStock} items available in stock`,
            };
        }
        return { valid: true };
    }

    calculateBulkDiscount(
        subtotal: number,
        discountPercent: number = 0,
    ): { discount: number; total: number } {
        const discount = subtotal * (discountPercent / 100);
        const total = subtotal - discount;
        return {
            discount: Math.round(discount * 100) / 100,
            total: Math.round(total * 100) / 100,
        };
    }
}
