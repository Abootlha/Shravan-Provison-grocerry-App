import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/schemas/user.schema';

export const ROLES_KEY = 'roles';

/**
 * Roles allowed on a route guarded by AdminGuard / RolesGuard. A method-level
 * decorator overrides the class-level one. Without it, only `admin` is allowed.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
