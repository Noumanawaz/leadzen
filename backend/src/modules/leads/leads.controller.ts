import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
  CreateLeadDto,
  CreateNoteDto,
  UpdateLeadDto,
} from './dto/leads.dto';
import { LeadsService } from './leads.service';

@ApiTags('leads')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1/leads')
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @RequirePermissions('leads:read')
  @Get()
  list(
    @OrgId() organizationId: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('pipelineId') pipelineId?: string,
    @Query('pipelineStageId') pipelineStageId?: string,
  ) {
    return this.leads.list(organizationId, {
      status,
      search,
      pipelineId,
      pipelineStageId,
    });
  }

  @RequirePermissions('leads:read')
  @Get('duplicates')
  duplicates(
    @OrgId() organizationId: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.leads.findDuplicates(organizationId, email, phone);
  }

  @RequirePermissions('leads:read')
  @Get(':id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.leads.get(organizationId, id);
  }

  @RequirePermissions('leads:create')
  @Post()
  create(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leads.create(organizationId, user.id, dto);
  }

  @RequirePermissions('leads:update')
  @Patch(':id')
  update(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leads.update(organizationId, id, user.id, dto);
  }

  @RequirePermissions('leads:delete')
  @Delete(':id')
  remove(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.leads.remove(organizationId, id);
  }

  @RequirePermissions('leads:update')
  @Post(':id/notes')
  addNote(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CreateNoteDto,
  ) {
    return this.leads.addNote(organizationId, id, user.id, dto);
  }
}
