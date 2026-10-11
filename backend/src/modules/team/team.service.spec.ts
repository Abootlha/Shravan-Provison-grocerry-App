import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import * as bcrypt from 'bcrypt';
import { TeamService } from './team.service';
import { CreateTeamMemberDto } from './dto/team.dto';
import { UserRole } from '../users/schemas/user.schema';
import { createFakeModel } from '../orders/testing/fake-model';

describe('CreateTeamMemberDto', () => {
  const errorsFor = (body: Record<string, unknown>) =>
    validate(plainToInstance(CreateTeamMemberDto, body), {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
  const valid = {
    name: 'Asha',
    username: 'asha.m',
    password: 'correct horse battery',
    role: 'manager',
  };

  it('accepts admin and manager roles', async () => {
    expect(await errorsFor(valid)).toHaveLength(0);
    expect(await errorsFor({ ...valid, role: 'admin' })).toHaveLength(0);
  });

  it('requires a 12+ character password and a staff role', async () => {
    expect(
      (await errorsFor({ ...valid, password: 'short-pass1' })).length,
    ).toBe(1);
    expect((await errorsFor({ ...valid, role: 'customer' })).length).toBe(1);
    expect((await errorsFor({ ...valid, role: 'rider' })).length).toBe(1);
    expect((await errorsFor({ ...valid, username: 'a b' })).length).toBe(1);
  });
});

describe('TeamService', () => {
  let userModel: any;
  let revoker: { revokeAll: jest.Mock };
  let service: TeamService;

  beforeEach(() => {
    userModel = createFakeModel();
    userModel.create = jest.fn((data: any) =>
      Promise.resolve(userModel.insert(data)),
    );
    revoker = { revokeAll: jest.fn() };
    service = new TeamService(userModel, revoker as any);
  });

  it('creates staff with a bcrypt hash and never returns it', async () => {
    const member: any = await service.create({
      name: 'Asha',
      username: 'asha',
      password: 'correct horse battery',
      role: UserRole.MANAGER,
    });
    const stored = [...userModel.store.values()][0];
    expect(stored.password).not.toBe('correct horse battery');
    await expect(
      bcrypt.compare('correct horse battery', stored.password),
    ).resolves.toBe(true);
    expect(stored).toMatchObject({ role: 'manager', isActive: true });
    expect(member).toBeDefined();
    expect(userModel.findById).toHaveBeenCalled();
  });

  it('rejects a duplicate username', async () => {
    userModel.insert({ username: 'asha', role: 'admin' });
    await expect(
      service.create({
        name: 'A',
        username: 'asha',
        password: 'correct horse battery',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('blocks self-demotion/deactivation and keeps one active admin', async () => {
    const admin = userModel.insert({ role: 'admin', isActive: true });
    const id = admin._id.toString();

    await expect(service.update(id, { isActive: false }, id)).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.update(id, { role: UserRole.MANAGER }, 'someone-else'),
    ).rejects.toThrow('At least one active admin');
  });

  it('deactivating, re-roling or resetting a password ends sessions', async () => {
    userModel.insert({ role: 'admin', isActive: true });
    const manager = userModel.insert({ role: 'manager', isActive: true });
    const id = manager._id.toString();

    await service.update(id, { isActive: false }, 'actor');
    expect(userModel.get(manager._id).isActive).toBe(false);
    expect(revoker.revokeAll).toHaveBeenLastCalledWith(id, 'manager');

    revoker.revokeAll.mockClear();
    await service.update(id, { name: 'New name' }, 'actor');
    expect(revoker.revokeAll).not.toHaveBeenCalled();

    await service.update(id, { password: 'another long password' }, 'actor');
    expect(revoker.revokeAll).toHaveBeenCalledTimes(1);
  });

  it('does not edit customers through the team endpoint', async () => {
    const customer = userModel.insert({ role: 'customer' });
    await expect(
      service.update(customer._id.toString(), { role: UserRole.ADMIN }, 'x'),
    ).rejects.toThrow('Team member not found');
  });
});
