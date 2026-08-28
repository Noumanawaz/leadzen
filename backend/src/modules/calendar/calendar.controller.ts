import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { OrgId } from '../../common/decorators/auth.decorators';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

class BookStubDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) startsAt!: string;
  @IsOptional() @IsString() leadId?: string;
  @IsOptional() @IsString() attendeeEmail?: string;
}

@ApiTags('calendar')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard)
@Controller('v1/calendar')
export class CalendarController {
  constructor(private readonly flags: FeatureFlagsService) {}

  @Get('status')
  async status(@OrgId() organizationId: string) {
    const enabled = await this.flags.isEnabled('calendar_stubs', organizationId);
    return {
      provider: 'stub',
      enabled,
      note: 'Calendar providers (Google/Outlook) ship in a later iteration. This endpoint is a hardened stub.',
    };
  }

  @Post('events')
  async createStub(
    @OrgId() organizationId: string,
    @Body() dto: BookStubDto,
  ) {
    const enabled = await this.flags.isEnabled('calendar_stubs', organizationId);
    if (!enabled) {
      return { ok: false, reason: 'calendar_stubs disabled' };
    }
    return {
      ok: true,
      event: {
        id: `cal_stub_${Date.now()}`,
        organizationId,
        title: dto.title,
        startsAt: dto.startsAt,
        leadId: dto.leadId ?? null,
        attendeeEmail: dto.attendeeEmail ?? null,
        provider: 'stub',
      },
    };
  }
}
