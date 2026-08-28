import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionService } from '../../modules/permissions/permission.service';
import type {
  MembershipRoleName,
  Permission,
} from '../../modules/permissions/permissions.catalog';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissions: PermissionService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      membership?: { role: MembershipRoleName };
    }>();
    const role = request.membership?.role;
    if (!role) {
      throw new ForbiddenException('Membership role required');
    }

    const missing = required.filter(
      (permission) => !this.permissions.can(role, permission),
    );
    if (missing.length) {
      throw new ForbiddenException(
        `Missing permissions: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
