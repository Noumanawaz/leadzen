import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import {
  CurrentUser,
  OrgId,
} from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthUserPayload } from '../../common/types/request-context';
import { AiService } from './ai.service';

class LeadIdDto {
  @IsString() @MinLength(1) leadId!: string;
}

class GenerateEmailDto extends LeadIdDto {
  @IsOptional() @IsString() goal?: string;
  @IsOptional() @IsString() tone?: string;
}

class GenerateReplyDto extends LeadIdDto {
  @IsString() @MinLength(1) inboundMessage!: string;
}

class CompanyResearchDto {
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() companyName?: string;
}

class CallSummaryDto {
  @IsString() @MinLength(1) transcript!: string;
  @IsOptional() @IsString() leadId?: string;
}

@ApiTags('ai')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1/ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @RequirePermissions('ai:use')
  @Get('requests')
  list(@OrgId() organizationId: string) {
    return this.ai.listRecent(organizationId);
  }

  @RequirePermissions('ai:use')
  @Post('lead-summary')
  leadSummary(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: LeadIdDto,
  ) {
    return this.ai.summarizeLead({
      organizationId,
      userId: user.id,
      leadId: dto.leadId,
    });
  }

  @RequirePermissions('ai:use')
  @Post('generate-email')
  generateEmail(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: GenerateEmailDto,
  ) {
    return this.ai.generateEmail({
      organizationId,
      userId: user.id,
      leadId: dto.leadId,
      goal: dto.goal,
      tone: dto.tone,
    });
  }

  @RequirePermissions('ai:use')
  @Post('generate-reply')
  generateReply(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: GenerateReplyDto,
  ) {
    return this.ai.generateReply({
      organizationId,
      userId: user.id,
      leadId: dto.leadId,
      inboundMessage: dto.inboundMessage,
    });
  }

  @RequirePermissions('ai:use')
  @Post('score-lead')
  scoreLead(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: LeadIdDto,
  ) {
    return this.ai.scoreLead({
      organizationId,
      userId: user.id,
      leadId: dto.leadId,
    });
  }

  @RequirePermissions('ai:use')
  @Post('company-research')
  companyResearch(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CompanyResearchDto,
  ) {
    return this.ai.researchCompany({
      organizationId,
      userId: user.id,
      companyId: dto.companyId,
      companyName: dto.companyName,
    });
  }

  @RequirePermissions('ai:use')
  @Post('call-summary')
  callSummary(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CallSummaryDto,
  ) {
    return this.ai.summarizeCall({
      organizationId,
      userId: user.id,
      leadId: dto.leadId,
      transcript: dto.transcript,
    });
  }
}
