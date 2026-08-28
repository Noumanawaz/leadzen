import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { OrgId } from '../../common/decorators/auth.decorators';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { LoadPlatformAdminGuard } from '../../common/guards/load-platform-admin.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { FeatureFlagsService } from './feature-flags.service';

class SetFlagDto {
  @IsString() @MinLength(1) key!: string;
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() description?: string;
}

class SetOverrideDto {
  @IsString() @MinLength(1) key!: string;
  @IsString() @MinLength(1) organizationId!: string;
  @IsBoolean() enabled!: boolean;
}

@ApiTags('feature-flags')
@Controller()
export class FeatureFlagsController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard)
  @Get('v1/feature-flags')
  tenantFlags(@OrgId() organizationId: string) {
    return this.flags.forOrganization(organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, LoadPlatformAdminGuard, PlatformAdminGuard)
  @Get('admin/feature-flags')
  adminList() {
    return this.flags.list();
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, LoadPlatformAdminGuard, PlatformAdminGuard)
  @Post('admin/feature-flags')
  adminSet(@Body() dto: SetFlagDto) {
    return this.flags.setGlobal(dto.key, dto.enabled, dto.description);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard, LoadPlatformAdminGuard, PlatformAdminGuard)
  @Post('admin/feature-flags/overrides')
  adminOverride(@Body() dto: SetOverrideDto) {
    return this.flags.setOverride(dto);
  }
}
