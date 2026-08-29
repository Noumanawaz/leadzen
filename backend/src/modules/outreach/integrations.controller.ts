import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { PlatformAdminStatus } from '../../../generated/prisma/client';
import {
  CurrentUser,
  OrgId,
} from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthUserPayload } from '../../common/types/request-context';
import type { AppEnv } from '../../config/env.validation';
import { PlatformAdminService } from '../admin/platform-admin.service';
import { GmailOAuthService } from '../email/gmail-oauth.service';
import { OutreachRouter } from './outreach.router';
import { SuppressionsService } from '../suppressions/suppressions.service';
import { WhatsAppIntegrationService } from '../whatsapp/whatsapp-integration.service';
import { WhatsAppTemplateService } from '../whatsapp/whatsapp-template.service';

class SendChannelDto {
  @IsString() toE164!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() templateName?: string;
  @IsOptional() @IsString() templateLanguage?: string;
}

class PlaceCallDto {
  @IsString() toE164!: string;
  @IsOptional() @IsString() leadId?: string;
}

class AddSuppressionDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @MinLength(1) reason!: string;
}

class SendEmailDto {
  @IsString() connectedAccountId!: string;
  @IsString() to!: string;
  @IsString() @MinLength(1) subject!: string;
  @IsString() @MinLength(1) body!: string;
  @IsOptional() @IsString() leadId?: string;
}

class WhatsAppConnectCompleteDto {
  @IsString() @MinLength(1) state!: string;
  @IsString() @MinLength(1) code!: string;
  @IsString() @MinLength(1) phoneNumberId!: string;
  @IsOptional() @IsString() wabaId?: string;
  @IsOptional() @IsString() businessId?: string;
}

class WhatsAppManualConnectDto {
  @IsString() @MinLength(1) accessToken!: string;
  @IsString() @MinLength(1) phoneNumberId!: string;
  @IsOptional() @IsString() wabaId?: string;
}

@ApiTags('integrations')
@Controller('v1/integrations')
export class IntegrationsController {
  constructor(
    private readonly gmail: GmailOAuthService,
    private readonly outreach: OutreachRouter,
    private readonly suppressions: SuppressionsService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly whatsappIntegration: WhatsAppIntegrationService,
    private readonly whatsappTemplates: WhatsAppTemplateService,
    private readonly platformAdmins: PlatformAdminService,
  ) {}

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Get('accounts')
  accounts(@OrgId() organizationId: string) {
    return this.outreach.listAccounts(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Get('send-accounts')
  sendAccounts(@OrgId() organizationId: string) {
    return this.outreach.listSendAccounts(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Get('gmail/connect')
  async gmailConnect(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.gmail.createConnectUrl(organizationId, user.id);
  }

  /** OAuth redirect target — public, state is signed JWT */
  @Get('gmail/callback')
  async gmailCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    const frontend = this.config.get('FRONTEND_URL', { infer: true });
    try {
      const ctx = await this.gmail.verifyState(state);
      const { tokens, email } = await this.gmail.exchangeCode(code);
      const encrypted = this.gmail.encryptTokens(tokens);
      await this.outreach.saveGmailAccount({
        organizationId: ctx.organizationId,
        email,
        encryptedCredentials: encrypted,
      });
      return res.redirect(
        `${frontend}/settings/integrations?gmail=connected&email=${encodeURIComponent(email)}`,
      );
    } catch {
      return res.redirect(`${frontend}/settings/integrations?gmail=error`);
    }
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Delete('accounts/:id')
  disconnect(
    @OrgId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.outreach.disconnect(organizationId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Post('email/send')
  sendEmail(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SendEmailDto,
  ) {
    return this.outreach.sendEmail({
      organizationId,
      userId: user.id,
      ...dto,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Post('whatsapp/send')
  sendWhatsApp(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SendChannelDto,
  ) {
    return this.outreach.sendWhatsApp({
      organizationId,
      userId: user.id,
      ...dto,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Post('sms/send')
  sendSms(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: SendChannelDto,
  ) {
    return this.outreach.sendSms({
      organizationId,
      userId: user.id,
      ...dto,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Post('phone/call')
  placeCall(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: PlaceCallDto,
  ) {
    return this.outreach.placeCall({
      organizationId,
      userId: user.id,
      ...dto,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:read')
  @Get('suppressions')
  listSuppressions(@OrgId() organizationId: string) {
    return this.suppressions.list(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('sequences:manage')
  @Post('suppressions')
  addSuppression(
    @OrgId() organizationId: string,
    @Body() dto: AddSuppressionDto,
  ) {
    if (dto.email) {
      return this.suppressions.addEmail(
        organizationId,
        dto.email,
        dto.reason,
        'manual',
      );
    }
    if (dto.phone) {
      return this.suppressions.addPhone(
        organizationId,
        dto.phone,
        dto.reason,
        'manual',
      );
    }
    throw new BadRequestException('email or phone is required');
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('sequences:manage')
  @Delete('suppressions/:id')
  removeSuppression(
    @OrgId() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.suppressions.remove(organizationId, id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Get('whatsapp')
  whatsAppIntegration(@OrgId() organizationId: string) {
    return this.outreach.getWhatsAppIntegration(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Get('whatsapp/connection')
  whatsAppConnection(@OrgId() organizationId: string) {
    return this.outreach.getWhatsAppIntegration(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Get('whatsapp/config')
  whatsAppConfig() {
    return this.whatsappIntegration.getPublicConfig();
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/connect/start')
  whatsAppConnectStart(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
  ) {
    return this.whatsappIntegration.createConnectState(organizationId, user.id);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/connect/complete')
  whatsAppConnectComplete(
    @OrgId() organizationId: string,
    @Body() dto: WhatsAppConnectCompleteDto,
  ) {
    return this.whatsappIntegration.completeConnect({
      organizationId,
      ...dto,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/connect/manual')
  async whatsAppManualConnect(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: WhatsAppManualConnectDto,
  ) {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (nodeEnv !== 'development') {
      const admin = await this.platformAdmins.resolveForUser({
        userId: user.id,
        email: user.email,
      });
      if (!admin || admin.status !== PlatformAdminStatus.active) {
        throw new ForbiddenException(
          'Manual WhatsApp connect is disabled. Use Connect WhatsApp in Integrations.',
        );
      }
    }
    return this.whatsappIntegration.manualConnect(organizationId, dto);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/disconnect')
  whatsAppDisconnect(@OrgId() organizationId: string) {
    return this.whatsappIntegration.disconnect(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/test')
  whatsAppTest(@OrgId() organizationId: string) {
    return this.whatsappIntegration.testConnection(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('integrations:connect')
  @Post('whatsapp/test-connection')
  whatsAppTestConnection(@OrgId() organizationId: string) {
    return this.whatsappIntegration.testConnection(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Get('whatsapp/templates')
  whatsAppTemplates(@OrgId() organizationId: string) {
    return this.whatsappTemplates.listTemplates(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('outreach:send')
  @Get('whatsapp/status')
  whatsAppStatus(@OrgId() organizationId: string) {
    return this.outreach.whatsAppStatus(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('leads:read')
  @Get('messages')
  listMessages(
    @OrgId() organizationId: string,
    @Query('leadId') leadId: string,
  ) {
    if (!leadId) {
      throw new BadRequestException('leadId query parameter is required');
    }
    return this.outreach.listLeadMessages(organizationId, leadId);
  }

  @Get('gmail/status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  gmailStatus() {
    return { configured: this.gmail.isConfigured() };
  }
}
