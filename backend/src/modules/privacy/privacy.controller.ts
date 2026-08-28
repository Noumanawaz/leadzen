import {
  Body,
  Controller,
  Get,
  Param,
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
import { PrivacyService } from './privacy.service';

class ExportDto {
  @IsOptional() @IsString() subjectEmail?: string;
}

class DeleteDto {
  @IsString() @MinLength(3) subjectEmail!: string;
}

@ApiTags('privacy')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1/privacy')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @RequirePermissions('org:update')
  @Get('retention')
  retention() {
    return { retentionDays: this.privacy.retentionDays() };
  }

  @RequirePermissions('org:update')
  @Get('requests')
  list(@OrgId() organizationId: string) {
    return this.privacy.list(organizationId);
  }

  @RequirePermissions('org:update')
  @Get('requests/:id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.privacy.get(organizationId, id);
  }

  @RequirePermissions('org:update')
  @Post('export')
  export(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ExportDto,
  ) {
    return this.privacy.requestExport({
      organizationId,
      userId: user.id,
      subjectEmail: dto.subjectEmail,
    });
  }

  @RequirePermissions('org:update')
  @Post('delete')
  delete(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: DeleteDto,
  ) {
    return this.privacy.requestDelete({
      organizationId,
      userId: user.id,
      subjectEmail: dto.subjectEmail,
    });
  }
}
