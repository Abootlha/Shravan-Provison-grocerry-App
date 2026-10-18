import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService, parseAddressRef } from './users.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

const oid = () => new Types.ObjectId();

/** Minimal stand-in for a hydrated user document. */
const makeUser = (addresses: any[]) => {
  const user: any = {
    _id: oid(),
    addresses: addresses.map((a) => ({ ...a })),
  };
  user.save = jest.fn().mockImplementation(() => Promise.resolve(user));
  return user;
};

const execOf = (value: unknown) => ({
  exec: jest.fn().mockResolvedValue(value),
});

describe('UsersService addresses', () => {
  let userModel: any;
  let service: UsersService;
  let user: any;

  const home = {
    type: 'Home',
    address: '214 Shivpuri Colony',
    city: 'Gorakhpur',
    pincode: '273016',
    isDefault: true,
  };
  const work = {
    type: 'Work',
    address: 'Shubham Complex',
    city: 'Gorakhpur',
    pincode: '273015',
    isDefault: false,
  };

  beforeEach(() => {
    userModel = {
      findById: jest.fn().mockImplementation(() => execOf(user)),
      updateOne: jest.fn().mockReturnValue(execOf({ modifiedCount: 1 })),
    };
    service = new UsersService(userModel);
  });

  describe('parseAddressRef', () => {
    it('accepts ObjectIds and small legacy indexes only', () => {
      const id = oid().toHexString();
      expect(parseAddressRef(id)).toBe(id);
      expect(parseAddressRef(id.toUpperCase())).toBe(id);
      expect(parseAddressRef('0')).toBe(0);
      expect(parseAddressRef('12')).toBe(12);
      expect(parseAddressRef('-1')).toBeNull();
      expect(parseAddressRef('1.5')).toBeNull();
      expect(parseAddressRef('abc')).toBeNull();
      expect(parseAddressRef('123456')).toBeNull();
    });
  });

  describe('findById backfill', () => {
    it('gives id-less addresses a stable id with one conditional update', async () => {
      const kept = oid();
      user = makeUser([{ ...home }, { ...work, _id: kept }]);

      const result = await service.findById(String(user._id));

      expect(userModel.updateOne).toHaveBeenCalledTimes(1);
      const [filter, update] = userModel.updateOne.mock.calls[0];
      expect(filter).toEqual({
        _id: user._id,
        addresses: { $size: 2 },
        'addresses.0._id': { $exists: false },
      });
      expect(Object.keys(update.$set)).toEqual(['addresses.0._id']);
      expect(result!.addresses[0]._id).toBe(update.$set['addresses.0._id']);
      expect(result!.addresses[1]._id).toBe(kept);
      expect(user.save).not.toHaveBeenCalled();
    });

    it('does not write when every address already has an id', async () => {
      user = makeUser([{ ...home, _id: oid() }]);
      await service.findById(String(user._id));
      expect(userModel.updateOne).not.toHaveBeenCalled();
    });

    it('re-reads the user when a concurrent request backfilled first', async () => {
      user = makeUser([{ ...home }]);
      const fresh = makeUser([{ ...home, _id: oid() }]);
      userModel.findById
        .mockImplementationOnce(() => execOf(user))
        .mockImplementationOnce(() => execOf(fresh));
      userModel.updateOne.mockReturnValue(execOf({ modifiedCount: 0 }));

      const result = await service.findById(String(user._id));
      expect(result).toBe(fresh);
    });

    it('never removes or reorders duplicate addresses on read', async () => {
      user = makeUser([
        { ...home, _id: oid() },
        { ...home, _id: oid(), isDefault: false },
      ]);
      const result = await service.findById(String(user._id));
      expect(result!.addresses).toHaveLength(2);
      expect(user.save).not.toHaveBeenCalled();
    });
  });

  describe('addAddress', () => {
    it('creates new addresses with an id and the optional details', async () => {
      user = makeUser([{ ...home, _id: oid() }]);
      await service.addAddress('u1', {
        ...work,
        houseNo: ' 4B ',
        floor: '2',
        landmark: 'Opp. Union Bank',
        receiverName: 'Riya',
        receiverPhone: '+919876543210',
      } as CreateAddressDto);

      const added = user.addresses[1];
      expect(Types.ObjectId.isValid(added._id)).toBe(true);
      expect(added).toMatchObject({
        houseNo: '4B',
        floor: '2',
        landmark: 'Opp. Union Bank',
        receiverName: 'Riya',
        receiverPhone: '9876543210',
        isDefault: false,
      });
    });

    it('updates the matching address in place instead of duplicating it', async () => {
      const id = oid();
      user = makeUser([{ ...home, _id: id }]);
      await service.addAddress('u1', {
        ...home,
        pincode: '273010',
      } as CreateAddressDto);
      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0]._id).toBe(id);
      expect(user.addresses[0].pincode).toBe('273010');
    });
  });

  describe('updateAddress', () => {
    it('updates by id', async () => {
      const id = oid();
      user = makeUser([
        { ...home, _id: oid() },
        { ...work, _id: id },
      ]);
      await service.updateAddress('u1', id.toHexString(), {
        landmark: 'Near the temple',
      } as UpdateAddressDto);
      expect(user.addresses[1].landmark).toBe('Near the temple');
      expect(user.addresses[0].landmark).toBeUndefined();
    });

    it('still accepts a legacy index', async () => {
      user = makeUser([
        { ...home, _id: oid() },
        { ...work, _id: oid() },
      ]);
      await service.updateAddress('u1', 1, {
        pincode: '273001',
      } as UpdateAddressDto);
      expect(user.addresses[1].pincode).toBe('273001');
    });

    it('clears optional details sent as empty strings', async () => {
      const id = oid();
      user = makeUser([{ ...home, _id: id, landmark: 'Old', floor: '3' }]);
      await service.updateAddress('u1', String(id), {
        landmark: '',
      } as UpdateAddressDto);
      expect(user.addresses[0].landmark).toBeUndefined();
      expect(user.addresses[0].floor).toBe('3');
    });

    it('moves the default flag when isDefault is set', async () => {
      const id = oid();
      user = makeUser([
        { ...home, _id: oid() },
        { ...work, _id: id },
      ]);
      await service.updateAddress('u1', String(id), {
        isDefault: true,
      } as UpdateAddressDto);
      expect(user.addresses.map((a: any) => a.isDefault)).toEqual([
        false,
        true,
      ]);
    });

    it('404s for an unknown id or an out-of-range index', async () => {
      user = makeUser([{ ...home, _id: oid() }]);
      await expect(
        service.updateAddress('u1', oid().toHexString(), {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.updateAddress('u1', 3, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('setDefaultAddress', () => {
    it('makes exactly one address the default', async () => {
      const id = oid();
      user = makeUser([
        { ...home, _id: oid() },
        { ...work, _id: id },
      ]);
      await service.setDefaultAddress('u1', String(id));
      expect(user.addresses.map((a: any) => a.isDefault)).toEqual([
        false,
        true,
      ]);
      expect(user.save).toHaveBeenCalled();
    });
  });

  describe('removeAddress', () => {
    it('removes by id and promotes a new default', async () => {
      const homeId = oid();
      const workId = oid();
      user = makeUser([
        { ...home, _id: homeId },
        { ...work, _id: workId },
      ]);
      await service.removeAddress('u1', String(homeId));
      expect(user.addresses).toHaveLength(1);
      expect(user.addresses[0]._id).toBe(workId);
      expect(user.addresses[0].isDefault).toBe(true);
    });

    it('ignores an out-of-range legacy index, as before', async () => {
      user = makeUser([{ ...home, _id: oid() }]);
      await service.removeAddress('u1', 5);
      expect(user.addresses).toHaveLength(1);
    });

    it('404s for an unknown id', async () => {
      user = makeUser([{ ...home, _id: oid() }]);
      await expect(
        service.removeAddress('u1', oid().toHexString()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

describe('Address DTO optional details', () => {
  const base = {
    type: 'Home',
    address: '214 Shivpuri Colony',
    city: 'Gorakhpur',
    pincode: '273016',
  };
  const errorsFor = async (extra: Record<string, unknown>) => {
    const errors = await validate(
      plainToInstance(CreateAddressDto, { ...base, ...extra }),
    );
    return errors.map((e) => e.property);
  };

  it('accepts valid details and empty strings', async () => {
    expect(
      await errorsFor({
        houseNo: '4B',
        floor: '2',
        landmark: 'Near Hanuman Mandir',
        receiverName: 'Riya',
        receiverPhone: '9876543210',
      }),
    ).toEqual([]);
    expect(await errorsFor({ receiverPhone: '+919876543210' })).toEqual([]);
    expect(await errorsFor({ landmark: '', receiverPhone: '' })).toEqual([]);
  });

  it('rejects malformed phones and oversized text', async () => {
    expect(await errorsFor({ receiverPhone: '12345' })).toEqual([
      'receiverPhone',
    ]);
    expect(await errorsFor({ receiverPhone: '5876543210' })).toEqual([
      'receiverPhone',
    ]);
    expect(await errorsFor({ landmark: 'x'.repeat(121) })).toEqual([
      'landmark',
    ]);
    expect(await errorsFor({ floor: 7 })).toEqual(['floor']);
  });
});
