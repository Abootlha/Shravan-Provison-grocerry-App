import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminGuard } from './admin.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../../users/schemas/user.schema';

class Fixture {
  adminOnly() {}

  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  staff() {}
}

@Roles(UserRole.ADMIN, UserRole.MANAGER)
class StaffController {
  open() {}

  @Roles(UserRole.ADMIN)
  restricted() {}
}

describe('AdminGuard / RolesGuard', () => {
  const guard = new AdminGuard(new Reflector());

  const ctx = (cls: any, handler: string, role?: string) =>
    ({
      getHandler: () => cls.prototype[handler],
      getClass: () => cls,
      switchToHttp: () => ({
        getRequest: () => ({ user: role ? { role } : undefined }),
      }),
    }) as any;

  const allows = (cls: any, handler: string, role?: string) => {
    try {
      return guard.canActivate(ctx(cls, handler, role));
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      return false;
    }
  };

  it('is admin-only without @Roles (existing routes stay closed to managers)', () => {
    expect(allows(Fixture, 'adminOnly', 'admin')).toBe(true);
    expect(allows(Fixture, 'adminOnly', 'manager')).toBe(false);
    expect(allows(Fixture, 'adminOnly', 'customer')).toBe(false);
    expect(allows(Fixture, 'adminOnly')).toBe(false);
  });

  it('opens routes to the roles listed with @Roles', () => {
    expect(allows(Fixture, 'staff', 'manager')).toBe(true);
    expect(allows(Fixture, 'staff', 'admin')).toBe(true);
    expect(allows(Fixture, 'staff', 'rider')).toBe(false);
  });

  it('method-level @Roles overrides the class-level one', () => {
    expect(allows(StaffController, 'open', 'manager')).toBe(true);
    expect(allows(StaffController, 'restricted', 'manager')).toBe(false);
    expect(allows(StaffController, 'restricted', 'admin')).toBe(true);
  });
});
