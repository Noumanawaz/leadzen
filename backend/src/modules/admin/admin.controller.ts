import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  MinLength,
} from 'class-validator';
import { OrganizationStatus } from '../../../generated/prisma/client';
import { CurrentUser } from '../../common/decorators/auth.decorators';
import { AuthGuard } from '../../common/guards/auth.guard';
import { LoadPlatformAdminGuard } from '../../common/guards/load-platform-admin.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import type { AuthUserPayload } from '../../common/types/request-context';
import { AdminService } from './admin.service';
import { PlatformAdminService } from './platform-admin.service';
import { WhatsAppIntegrationService } from '../whatsapp/whatsapp-integration.service';

class UpdateOrgStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;
}

class AdjustCreditsDto {
  @IsString() @MinLength(1) organizationId!: string;
  @IsInt() amount!: number;
  @IsString() @MinLength(1) reason!: string;
}

class ImpersonateDto {
  @IsString() @MinLength(1) organizationId!: string;
  @IsString() @MinLength(8) reason!: string;
}

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AuthGuard, LoadPlatformAdminGuard, PlatformAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly platformAdmins: PlatformAdminService,
    private readonly whatsappIntegration: WhatsAppIntegrationService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUserPayload) {
    const admin = await this.platformAdmins.requireActive({
      userId: user.id,
      email: user.email,
    });
    return {
      user: {
        id: user.id,
        email: user.email,
      },
      platformAdmin: {
        id: admin.id,
        status: admin.status,
        mfaRequired: admin.mfaRequired,
        lastLoginAt: admin.lastLoginAt,
      },
      allowlistConfigured: this.platformAdmins.parseAllowlist().length > 0,
    };
  }

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('organizations')
  organizations(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.admin.listOrganizations({ search, status });
  }

  @Get('organizations/:id')
  organization(@Param('id') id: string) {
    return this.admin.getOrganization(id);
  }

  @Patch('organizations/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrgStatusDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const admin = await this.platformAdmins.requireActive({
      userId: user.id,
      email: user.email,
    });
    return this.admin.updateOrganizationStatus({
      organizationId: id,
      status: dto.status,
      platformAdminId: admin.id,
      actorUserId: user.id,
    });
  }

  @Get('users')
  users(@Query('search') search?: string) {
    return this.admin.listUsers({ search });
  }

  @Get('subscriptions')
  subscriptions() {
    return this.admin.listSubscriptions();
  }

  @Get('usage')
  usage(@Query('take') take?: string) {
    return this.admin.listUsage(take ? Number(take) : 50);
  }

  @Get('ai-requests')
  aiRequests(@Query('take') take?: string) {
    return this.admin.listAiRequests(take ? Number(take) : 50);
  }

  @Get('audit-logs')
  auditLogs(@Query('take') take?: string) {
    return this.admin.listAuditLogs(take ? Number(take) : 100);
  }

  @Post('credits/adjust')
  async adjustCredits(
    @Body() dto: AdjustCreditsDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const admin = await this.platformAdmins.requireActive({
      userId: user.id,
      email: user.email,
    });
    return this.admin.adjustCredits({
      organizationId: dto.organizationId,
      amount: dto.amount,
      reason: dto.reason,
      platformAdminId: admin.id,
      actorUserId: user.id,
    });
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.admin.search(q);
  }

  @Post('impersonation/start')
  async impersonate(
    @Body() dto: ImpersonateDto,
    @CurrentUser() user: AuthUserPayload,
  ) {
    const admin = await this.platformAdmins.requireActive({
      userId: user.id,
      email: user.email,
    });
    return this.admin.startImpersonation({
      organizationId: dto.organizationId,
      platformAdminId: admin.id,
      actorUserId: user.id,
      reason: dto.reason,
    });
  }

  @Get('health')
  health() {
    return this.admin.systemHealth();
  }

  @Get('settings')
  settings() {
    return {
      allowlistCount: this.platformAdmins.parseAllowlist().length,
      note: 'Platform admins are seeded only via ADMIN_EMAIL_ALLOWLIST. There is no self-promote UI.',
    };
  }

  @Get('settings/integrations')
  integrationSettings() {
    return {
      whatsapp: this.whatsappIntegration.getPlatformSetupStatus(),
    };
  }
}
