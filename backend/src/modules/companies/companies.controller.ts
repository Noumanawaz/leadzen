import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { OrgId } from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CompaniesService } from './companies.service';
import {
  CreateCompanyDto,
  CreateContactDto,
  LinkCompanyContactDto,
  UpdateCompanyDto,
} from './dto/companies.dto';

@ApiTags('companies')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller('v1')
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @RequirePermissions('companies:read')
  @Get('companies')
  list(@OrgId() organizationId: string) {
    return this.companies.list(organizationId);
  }

  @RequirePermissions('companies:read')
  @Get('companies/:id')
  get(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.companies.get(organizationId, id);
  }

  @RequirePermissions('companies:create')
  @Post('companies')
  create(@OrgId() organizationId: string, @Body() dto: CreateCompanyDto) {
    return this.companies.create(organizationId, dto);
  }

  @RequirePermissions('companies:update')
  @Patch('companies/:id')
  update(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.companies.update(organizationId, id, dto);
  }

  @RequirePermissions('companies:delete')
  @Delete('companies/:id')
  remove(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.companies.remove(organizationId, id);
  }

  @RequirePermissions('companies:update')
  @Post('companies/:id/contacts')
  linkContact(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: LinkCompanyContactDto,
  ) {
    return this.companies.linkContact(organizationId, id, dto);
  }

  @RequirePermissions('contacts:read')
  @Get('contacts')
  listContacts(@OrgId() organizationId: string) {
    return this.companies.listContacts(organizationId);
  }

  @RequirePermissions('contacts:create')
  @Post('contacts')
  createContact(
    @OrgId() organizationId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.companies.createContact(organizationId, dto);
  }
}
