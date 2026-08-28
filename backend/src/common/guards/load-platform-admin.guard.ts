import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RequestContext } from '../types/request-context';
import { PlatformAdminService } from '../../modules/admin/platform-admin.service';

/**
 * Loads / bootstraps platform_admins for the authenticated user.
 * Must run after AuthGuard. Does not grant access by itself —
 * pair with PlatformAdminGuard.
 */
@Injectable()
export class LoadPlatformAdminGuard implements CanActivate {
  constructor(private readonly platformAdmins: PlatformAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & RequestContext>();
    if (!request.user?.id || !request.user.email) {
      throw new UnauthorizedException('Authentication required');
    }

    const admin = await this.platformAdmins.resolveForUser({
      userId: request.user.id,
      email: request.user.email,
    });

    if (admin) {
      request.platformAdmin = {
        id: admin.id,
        status: admin.status,
      };
    }

    return true;
  }
}
