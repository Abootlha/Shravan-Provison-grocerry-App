import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddToCartDto, UpdateCartItemDto } from './cart.dto';

const productId = '507f1f77bcf86cd799439011';

describe('Cart DTOs', () => {
  it('accepts a valid add-to-cart body', async () => {
    const errors = await validate(
      plainToInstance(AddToCartDto, { productId, quantity: 2 }),
    );
    expect(errors).toHaveLength(0);
  });

  it.each([0, -1, 1.5, 1000, '2'])(
    'rejects add quantity %p',
    async (quantity) => {
      const errors = await validate(
        plainToInstance(AddToCartDto, { productId, quantity }),
      );
      expect(errors.length).toBeGreaterThan(0);
    },
  );

  it('rejects a non-ObjectId productId', async () => {
    const errors = await validate(
      plainToInstance(AddToCartDto, { productId: { $gt: '' } }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('allows quantity 0 on update (removes the item)', async () => {
    const errors = await validate(
      plainToInstance(UpdateCartItemDto, { productId, quantity: 0 }),
    );
    expect(errors).toHaveLength(0);
  });
});
