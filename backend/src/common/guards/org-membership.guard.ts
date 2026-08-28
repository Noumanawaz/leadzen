import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { MembershipStatus } from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RequestContext } from '../types/request-context';

export const ORG_HEADER = 'x-organization-id';

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & RequestContext>();
    if (!request.user?.id) {
      throw new ForbiddenException('Authentication required');
    }

    const organizationId = request.headers[ORG_HEADER];
    if (typeof organizationId !== 'string' || !organizationId) {
      throw new ForbiddenException('X-Organization-Id header required');
    }

    const membership = await this.prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: request.user.id,
        },
      },
    });

    if (!membership || membership.status !== MembershipStatus.active) {
      throw new ForbiddenException('Active organization membership required');
    }

    request.membership = {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      role: membership.role,
      status: membership.status,
    };
    return true;
  }
}
