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
});
