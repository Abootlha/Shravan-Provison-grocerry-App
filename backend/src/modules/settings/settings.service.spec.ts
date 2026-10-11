import { SettingsService } from './settings.service';
import { DEFAULT_FEES, resolveFees } from './fees';

describe('SettingsService', () => {
  const baseDoc = {
    storeName: 'Store',
    location: { latitude: 26.7, longitude: 83.3, address: 'Road' },
    storeTimings: { openTime: '08:00', closeTime: '22:00' },
    serviceRadiusKm: 4,
    estimatedDeliveryMinutes: 10,
    isActive: true,
  };

  it('falls back to the default fees for documents created before fees existed', () => {
    expect(resolveFees(undefined)).toEqual(DEFAULT_FEES);
    expect(resolveFees({ deliveryFee: 40 })).toEqual({
      ...DEFAULT_FEES,
      deliveryFee: 40,
    });
  });

  it('public view includes fees, timezone and the computed open state', () => {
    const view = SettingsService.toPublicView(
      baseDoc as any,
      new Date('2026-10-12T23:30:00+05:30'),
    );
    expect(view).toMatchObject({
      fees: DEFAULT_FEES,
      timezone: 'Asia/Kolkata',
      isOpen: false,
      nextOpenAt: new Date('2026-10-13T08:00:00+05:30').toISOString(),
      contactPhone: null,
      contactEmail: null,
      gstin: null,
    });
  });

  it('merges fee updates field by field and never writes storeId', async () => {
    const findOneAndUpdate = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(baseDoc),
    });
    const service = new SettingsService({ findOneAndUpdate } as any);

    await service.updateStoreSettings({
      fees: { deliveryFee: 30 },
      gstin: '09aaach7409r1zz',
      timezone: 'Asia/Kolkata',
    });

    const [, update] = findOneAndUpdate.mock.calls[0];
    expect(update.$set).toEqual({
      'fees.deliveryFee': 30,
      gstin: '09AAACH7409R1ZZ',
      timezone: 'Asia/Kolkata',
    });
  });
});
