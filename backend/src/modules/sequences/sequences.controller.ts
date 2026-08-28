import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SequenceStepChannel } from '../../../generated/prisma/client';
import { OrgId } from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { SequenceQueueService } from './sequence-queue.service';
import { SequencesService } from './sequences.service';

class StepDto {
  @IsEnum(SequenceStepChannel)
  channel!: SequenceStepChannel;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  delayDays?: number;

  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() body?: string;
}

class CreateSequenceDto {
  @IsString() @MinLength(1) name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];
}

class EnrollDto {
  @IsString() leadId!: string;
}

@ApiTags('sequences')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1')
export class SequencesController {
  constructor(
    private readonly sequences: SequencesService,
    private readonly queue: SequenceQueueService,
  ) {}

  @RequirePermissions('sequences:manage')
  @Get('sequences')
  list(@OrgId() organizationId: string) {
    return this.sequences.list(organizationId);
  }

  @RequirePermissions('sequences:manage')
  @Get('sequences/:id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.sequences.get(organizationId, id);
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences')
  create(@OrgId() organizationId: string, @Body() dto: CreateSequenceDto) {
    return this.sequences.create(organizationId, {
      name: dto.name,
      steps: dto.steps.map((s) => ({
        channel: s.channel,
        delayDays: s.delayDays,
        subject: s.subject,
        body: s.body,
      })),
    });
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/:id/activate')
  activate(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.sequences.activate(organizationId, id);
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/:id/pause')
  pause(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.sequences.pause(organizationId, id);
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/:id/archive')
  archive(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.sequences.archive(organizationId, id);
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/:id/enroll')
  enroll(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: EnrollDto,
  ) {
    return this.sequences.enroll(organizationId, id, dto.leadId);
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/enrollments/:id/stop')
  stop(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.sequences.stopEnrollment(organizationId, id, 'manual');
  }

  @RequirePermissions('sequences:manage')
  @Post('sequences/process-due')
  processDue() {
    return this.queue.enqueueNow();
  }
}
