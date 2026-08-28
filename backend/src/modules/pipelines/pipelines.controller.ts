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
import type { AuthUserPayload } from '../../common/types/request-context';
import {
  CreateDealDto,
  CreatePipelineDto,
  CreateTaskDto,
  UpdateDealStatusDto,
} from './dto/pipelines.dto';
import { PipelinesService } from './pipelines.service';

@ApiTags('pipelines')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1')
export class PipelinesController {
  constructor(private readonly pipelines: PipelinesService) {}

  @RequirePermissions('leads:read')
  @Get('pipelines')
  list(@OrgId() organizationId: string) {
    return this.pipelines.list(organizationId);
  }

  @RequirePermissions('pipelines:manage')
  @Post('pipelines')
  create(@OrgId() organizationId: string, @Body() dto: CreatePipelineDto) {
    return this.pipelines.create(organizationId, dto);
  }

  @RequirePermissions('leads:create')
  @Post('pipelines/ensure-default')
  ensureDefault(@OrgId() organizationId: string) {
    return this.pipelines.ensureDefault(organizationId);
  }

  @RequirePermissions('deals:manage')
  @Get('deals')
  listDeals(@OrgId() organizationId: string) {
    return this.pipelines.listDeals(organizationId);
  }

  @RequirePermissions('deals:manage')
  @Post('deals')
  createDeal(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateDealDto,
  ) {
    return this.pipelines.createDeal(organizationId, user.id, dto);
  }

  @RequirePermissions('deals:manage')
  @Patch('deals/:id/status')
  updateDealStatus(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDealStatusDto,
  ) {
    return this.pipelines.updateDealStatus(organizationId, id, dto.status);
  }

  @RequirePermissions('leads:read')
  @Get('tasks')
  listTasks(@OrgId() organizationId: string) {
    return this.pipelines.listTasks(organizationId);
  }

  @RequirePermissions('leads:update')
  @Post('tasks')
  createTask(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateTaskDto,
  ) {
    return this.pipelines.createTask(organizationId, user.id, dto);
  }

  @RequirePermissions('leads:update')
  @Patch('tasks/:id/complete')
  completeTask(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.pipelines.completeTask(organizationId, id);
  }
}
