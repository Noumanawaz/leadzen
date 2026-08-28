import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { OrgId } from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CreditService } from './credit.service';

@ApiTags('credits')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@RequirePermissions('org:read')
@Controller('v1/credits')
export class CreditsController {
  constructor(private readonly credits: CreditService) {}

  @Get('balance')
  async balance(@OrgId() organizationId: string) {
    const balance = await this.credits.getBalance(organizationId);
    return { balance };
  }
}
