import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/schemas/user.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Allows the request when the authenticated user's role is listed in
 * @Roles(...) (method first, then class). Routes without @Roles are
 * admin-only, so every existing admin route stays closed to managers until it
 * is explicitly opened.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(protected readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const allowed = this.reflector.getAllAndOverride<string[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? [UserRole.ADMIN];

    if (!user || !allowed.includes(user.role)) {
      throw new ForbiddenException(
        allowed.length === 1 && allowed[0] === (UserRole.ADMIN as string)
          ? 'Admin access required'
          : 'You do not have permission to do this',
      );
    }
    return true;
  }
}
