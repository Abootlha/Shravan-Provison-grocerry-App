import { UnauthorizedException } from '@nestjs/common';
import { RidersService } from './riders.service';

describe('RidersService.ensureOtpRider', () => {
  const riderModel = { findOne: jest.fn() };
  const service = new RidersService(
    riderModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  beforeEach(() => jest.clearAllMocks());

  it('returns an existing active rider', async () => {
    const rider = { _id: 'r1', isActive: true };
    riderModel.findOne.mockResolvedValue(rider);
    await expect(service.ensureOtpRider('9999999999')).resolves.toBe(rider);
  });

  it('never creates a rider for an unknown phone', async () => {
    riderModel.findOne.mockResolvedValue(null);
    await expect(service.ensureOtpRider('9999999999')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects inactive riders', async () => {
    riderModel.findOne.mockResolvedValue({ _id: 'r1', isActive: false });
    await expect(service.ensureOtpRider('9999999999')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
