import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateStoreSettingsDto } from './update-store-settings.dto';

const errorsFor = async (body: Record<string, unknown>) =>
  validate(plainToInstance(UpdateStoreSettingsDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('UpdateStoreSettingsDto', () => {
  it('accepts the payload sent by the admin DeliveryManager', async () => {
    const errors = await errorsFor({
      storeName: 'Shravan Kirana',
      location: { address: 'Gorakhpur', latitude: 26.69, longitude: 83.46 },
      storeTimings: { openTime: '08:00', closeTime: '22:00' },
      contactPhone: '',
      serviceRadiusKm: 4,
      estimatedDeliveryMinutes: 10,
      isActive: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown fields such as storeId', async () => {
    const errors = await errorsFor({ storeId: 'other' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects out-of-range radius and coordinates', async () => {
    expect((await errorsFor({ serviceRadiusKm: 5000 })).length).toBe(1);
    expect(
      (
        await errorsFor({
          location: { address: 'x', latitude: 200, longitude: 0 },
        })
      ).length,
    ).toBe(1);
  });

  it('accepts the new contact, timezone and partial fee fields', async () => {
    const errors = await errorsFor({
      contactEmail: 'store@example.com',
      address: 'Shop 1, Main Road',
      gstin: '09AAACH7409R1ZZ',
      timezone: 'Asia/Kolkata',
      fees: { deliveryFee: 30, discountRate: 0 },
    });
    expect(errors).toHaveLength(0);
  });

  it('allows clearing email and gstin with an empty string', async () => {
    expect(await errorsFor({ contactEmail: '', gstin: '' })).toHaveLength(0);
  });

  it('rejects invalid email, gstin, timezone and fees', async () => {
    expect((await errorsFor({ contactEmail: 'nope' })).length).toBe(1);
    expect((await errorsFor({ gstin: '1234' })).length).toBe(1);
    expect((await errorsFor({ timezone: 'Mars/Base' })).length).toBe(1);
    expect((await errorsFor({ fees: { deliveryFee: -1 } })).length).toBe(1);
    expect((await errorsFor({ fees: { discountRate: 2 } })).length).toBe(1);
    expect((await errorsFor({ fees: { unknown: 1 } })).length).toBe(1);
  });
});
