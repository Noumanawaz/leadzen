import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Phase 0 stub — Phase 7 verifies platform_admins row.
 * Never treat tenant owner as platform admin.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      platformAdmin?: { id: string; status: string };
    }>();
    if (
      !request.platformAdmin ||
      request.platformAdmin.status !== 'active'
    ) {
      throw new ForbiddenException('Platform admin access required');
    }
    return true;
  }
}
