import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

/**
 * Staff guard. Admin-only by default; a route (or controller) can open itself
 * to managers with @Roles(UserRole.ADMIN, UserRole.MANAGER).
 */
@Injectable()
export class AdminGuard extends RolesGuard {
  constructor(reflector: Reflector) {
    super(reflector);
  }
}
