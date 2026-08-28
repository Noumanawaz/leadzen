import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  OrgId,
} from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type {
  AuthUserPayload,
  MembershipContext,
} from '../../common/types/request-context';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import {
  CreateOrganizationDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
  CompleteInviteDto,
} from './dto/organizations.dto';
import { OrganizationsService } from './organizations.service';

const CurrentMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): MembershipContext => {
    const request = ctx.switchToHttp().getRequest<{ membership: MembershipContext }>();
    return request.membership;
  },
);

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @UseGuards(AuthGuard)
  @Get()
  list(@CurrentUser() user: AuthUserPayload) {
    return this.organizations.listForUser(user.id);
  }

  @UseGuards(AuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.organizations.create(user.id, dto);
  }

  @UseGuards(AuthGuard)
  @Post('invites/:token/accept')
  acceptInvite(
    @CurrentUser() user: AuthUserPayload,
    @Param('token') token: string,
  ) {
    return this.organizations.acceptInvite(user.id, token);
  }

  /** Public invite preview — no auth */
  @Get('invites/:token')
  invitePreview(@Param('token') token: string) {
    return this.organizations.getInvitePreview(token);
  }

  /** Public invite completion — sets password for shell users */
  @Post('invites/:token/complete')
  completeInvite(
    @Param('token') token: string,
    @Body() dto: CompleteInviteDto,
  ) {
    return this.organizations.completeInvite(token, dto);
  }

  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:read')
  @Get('current')
  current(@OrgId() organizationId: string) {
    return this.organizations.getCurrent(organizationId);
  }

  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:update')
  @Patch('current')
  updateCurrent(
    @OrgId() organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.updateCurrent(organizationId, dto);
  }

  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:read')
  @Get('members')
  members(@OrgId() organizationId: string) {
    return this.organizations.listMembers(organizationId);
  }

  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('members:invite')
  @Post('members/invite')
  invite(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @CurrentMembership() membership: MembershipContext,
    @Body() dto: InviteMemberDto,
  ) {
    return this.organizations.invite(
      organizationId,
      user.id,
      membership.role,
      dto,
    );
  }

  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('members:update_role')
  @Patch('members/:membershipId/role')
  updateRole(
    @OrgId() organizationId: string,
    @Param('membershipId') membershipId: string,
    @CurrentUser() user: AuthUserPayload,
    @CurrentMembership() membership: MembershipContext,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.organizations.updateRole(
      organizationId,
      membershipId,
      user.id,
      membership.role,
      dto,
    );
  }
}
