import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
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
  ApolloConnectDto,
  ApolloImportDto,
  ApolloSearchDto,
  CreateApiKeyDto,
  CreateLeadFormDto,
  CreateLeadSourceDto,
  CreateReferralLinkDto,
  GooglePlacesConnectDto,
  PlacesImportDto,
  PlacesSearchDto,
  UpdateImportMappingDto,
  UpdateLeadFormDto,
} from './dto/lead-discovery.dto';
import { ImportQueueService } from './import-queue.service';
import { CreditCostService } from './credit-cost.service';
import { FIND_LEADS_COST_CODES } from './credit-cost.constants';
import { LeadDiscoveryService } from './lead-discovery.service';
import { LeadFormsService } from './lead-forms.service';
import { LeadImportService } from './lead-import.service';
import { ApolloProvider } from './providers/apollo.provider';
import { GooglePlacesProvider } from './providers/google-places.provider';
import {
  OrganizationApiKeysService,
  ReferralLinksService,
} from './referral-api.service';

@ApiTags('lead-discovery')
@ApiBearerAuth()
@ApiHeader({ name: 'x-organization-id', required: true })
@UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
@Controller()
export class LeadDiscoveryController {
  constructor(
    private readonly discovery: LeadDiscoveryService,
    private readonly imports: LeadImportService,
    private readonly queue: ImportQueueService,
    private readonly places: GooglePlacesProvider,
    private readonly apollo: ApolloProvider,
    private readonly forms: LeadFormsService,
    private readonly referrals: ReferralLinksService,
    private readonly apiKeys: OrganizationApiKeysService,
    private readonly creditCosts: CreditCostService,
  ) {}

  @RequirePermissions('leads:import')
  @Get('v1/leads/find/credit-costs')
  findLeadsCreditCosts(@OrgId() organizationId: string) {
    return this.creditCosts.getFindLeadsPricing(organizationId);
  }

  @RequirePermissions('lead_sources:manage')
  @Get('v1/lead-sources')
  listSources(@OrgId() organizationId: string) {
    return this.discovery.listSources(organizationId);
  }

  @RequirePermissions('lead_sources:manage')
  @Post('v1/lead-sources')
  createSource(
    @OrgId() organizationId: string,
    @Body() dto: CreateLeadSourceDto,
  ) {
    return this.discovery.createSource(organizationId, {
      type: dto.type,
      name: dto.name,
      integrationId: dto.integrationId,
      configuration: dto.configuration as never,
    });
  }

  @RequirePermissions('leads:import')
  @Get('v1/leads/imports')
  listImports(@OrgId() organizationId: string) {
    return this.imports.list(organizationId);
  }

  @RequirePermissions('leads:import')
  @Get('v1/leads/imports/:id')
  getImport(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.imports.get(organizationId, id);
  }

  @RequirePermissions('leads:import')
  @ApiConsumes('multipart/form-data')
  @Post('v1/leads/imports')
  @UseInterceptors(FileInterceptor('file'))
  uploadImport(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('file is required');
    }
    return this.imports.createFromUpload({
      organizationId,
      userId: user.id,
      filename: file.originalname,
      buffer: file.buffer,
    });
  }

  @RequirePermissions('leads:import')
  @Patch('v1/leads/imports/:id/mapping')
  mapImport(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateImportMappingDto,
  ) {
    return this.imports.updateMapping(
      organizationId,
      id,
      dto.mapping,
      dto.duplicatePolicy,
    );
  }

  @RequirePermissions('leads:import')
  @Post('v1/leads/imports/:id/start')
  async startImport(
    @OrgId() organizationId: string,
    @Param('id') id: string,
  ) {
    const job = await this.imports.markQueued(organizationId, id);
    await this.queue.enqueue(id);
    return job;
  }

  @RequirePermissions('leads:import')
  @Get('v1/leads/imports/:id/errors.csv')
  @Header('Content-Type', 'text/csv')
  async importErrors(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const csv = await this.imports.errorsCsv(organizationId, id);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="import-${id}-errors.csv"`,
    );
    res.send(csv);
  }

  @RequirePermissions('leads:import')
  @Get('v1/integrations/google-places/status')
  placesStatus(@OrgId() organizationId: string) {
    return this.places.status(organizationId);
  }

  @RequirePermissions('integrations:connect')
  @Post('v1/integrations/google-places/connect')
  placesConnect(
    @OrgId() organizationId: string,
    @Body() dto: GooglePlacesConnectDto,
  ) {
    return this.places.connectOrgKey(organizationId, dto.apiKey, dto.label);
  }

  @RequirePermissions('leads:import')
  @Post('v1/leads/find/google-maps/search')
  async placesSearch(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: PlacesSearchDto,
  ) {
    const creditsUsed = await this.creditCosts.debitOperation({
      organizationId,
      code: FIND_LEADS_COST_CODES.GOOGLE_PLACES_SEARCH,
      actorUserId: user.id,
      metadata: { textQuery: dto.textQuery },
    });

    const leads = await this.places.search(organizationId, {
      textQuery: dto.textQuery,
      maxResultCount: dto.maxResultCount,
      locationBias:
        dto.latitude != null && dto.longitude != null
          ? {
              latitude: dto.latitude,
              longitude: dto.longitude,
              radiusMeters: dto.radiusMeters,
            }
          : undefined,
    });
    const results = await this.discovery.preview(organizationId, leads);
    return { results, creditsUsed };
  }

  @RequirePermissions('leads:import')
  @Post('v1/leads/find/google-maps/import')
  placesImport(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: PlacesImportDto,
  ) {
    const leads = dto.places.map((raw) => {
      const p = raw ?? {};
      const str = (key: string) => {
        const v = p[key];
        return typeof v === 'string' && v.trim() ? v.trim() : null;
      };
      return {
        companyName: str('companyName'),
        phone: str('phone'),
        website: str('website'),
        city: str('city'),
        state: str('state'),
        country: str('country'),
        sourceType: 'google_places' as const,
        sourceExternalId: str('sourceExternalId'),
        sourceName: 'Google Places',
        sourceMetadata:
          p.sourceMetadata && typeof p.sourceMetadata === 'object'
            ? (p.sourceMetadata as Record<string, unknown>)
            : undefined,
      };
    });

    return this.discovery.commit({
      organizationId,
      actorUserId: user.id,
      creditCostCode: FIND_LEADS_COST_CODES.GOOGLE_PLACES_IMPORT,
      duplicatePolicy: 'skip',
      leads,
    });
  }

  @RequirePermissions('leads:import')
  @Get('v1/integrations/apollo/status')
  apolloStatus(@OrgId() organizationId: string) {
    return this.apollo.status(organizationId);
  }

  @RequirePermissions('integrations:connect')
  @Post('v1/integrations/apollo/connect')
  apolloConnect(
    @OrgId() organizationId: string,
    @Body() dto: ApolloConnectDto,
  ) {
    return this.apollo.connect(organizationId, dto.apiKey, dto.label);
  }

  @RequirePermissions('integrations:connect')
  @Delete('v1/integrations/apollo')
  apolloDisconnect(@OrgId() organizationId: string) {
    return this.apollo.disconnect(organizationId);
  }

  @RequirePermissions('leads:import')
  @Post('v1/leads/find/apollo/search')
  async apolloSearch(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ApolloSearchDto,
  ) {
    const creditsUsed = await this.creditCosts.debitOperation({
      organizationId,
      code: FIND_LEADS_COST_CODES.APOLLO_SEARCH,
      actorUserId: user.id,
      metadata: { qKeywords: dto.qKeywords },
    });

    const leads = await this.apollo.search(organizationId, dto);
    const results = await this.discovery.preview(organizationId, leads);
    return { results, creditsUsed };
  }

  @RequirePermissions('leads:import')
  @Post('v1/leads/find/apollo/import')
  apolloImport(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: ApolloImportDto,
  ) {
    return this.discovery.commit({
      organizationId,
      actorUserId: user.id,
      creditCostCode: FIND_LEADS_COST_CODES.APOLLO_IMPORT,
      duplicatePolicy: 'skip',
      leads: dto.people.map((p) => this.apollo.normalize(p)),
    });
  }

  @RequirePermissions('lead_sources:manage')
  @Get('v1/lead-forms')
  listForms(@OrgId() organizationId: string) {
    return this.forms.list(organizationId);
  }

  @RequirePermissions('lead_sources:manage')
  @Post('v1/lead-forms')
  createForm(
    @OrgId() organizationId: string,
    @Body() dto: CreateLeadFormDto,
  ) {
    return this.forms.create(organizationId, dto);
  }

  @RequirePermissions('lead_sources:manage')
  @Patch('v1/lead-forms/:id')
  updateForm(
    @OrgId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadFormDto,
  ) {
    return this.forms.update(organizationId, id, dto);
  }

  @RequirePermissions('lead_sources:manage')
  @Get('v1/referral-links')
  listReferrals(@OrgId() organizationId: string) {
    return this.referrals.list(organizationId);
  }

  @RequirePermissions('lead_sources:manage')
  @Post('v1/referral-links')
  createReferral(
    @OrgId() organizationId: string,
    @Body() dto: CreateReferralLinkDto,
  ) {
    return this.referrals.create(organizationId, dto);
  }

  @RequirePermissions('api_keys:manage')
  @Get('v1/api-keys')
  listApiKeys(@OrgId() organizationId: string) {
    return this.apiKeys.list(organizationId);
  }

  @RequirePermissions('api_keys:manage')
  @Post('v1/api-keys')
  createApiKey(
    @OrgId() organizationId: string,
    @Body() dto: CreateApiKeyDto,
  ) {
    return this.apiKeys.create(organizationId, dto.name);
  }

  @RequirePermissions('api_keys:manage')
  @Delete('v1/api-keys/:id')
  revokeApiKey(@OrgId() organizationId: string, @Param('id') id: string) {
    return this.apiKeys.revoke(organizationId, id);
  }
}

@ApiTags('public-lead-discovery')
@Controller('public')
export class PublicLeadDiscoveryController {
  constructor(
    private readonly forms: LeadFormsService,
    private readonly referrals: ReferralLinksService,
    private readonly apiKeys: OrganizationApiKeysService,
  ) {}

  @Get('forms/:publicId')
  getForm(@Param('publicId') publicId: string) {
    return this.forms.getPublic(publicId);
  }

  @Post('forms/:publicId/submit')
  submitForm(
    @Param('publicId') publicId: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.forms.submit(publicId, body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('r/:code')
  trackReferral(@Param('code') code: string) {
    return this.referrals.trackClick(code);
  }

  @Post('r/:code/convert')
  convertReferral(
    @Param('code') code: string,
    @Body() body: Record<string, string>,
  ) {
    return this.referrals.convert(code, body);
  }

  @Post('v1/leads')
  ingest(
    @Req() req: Request,
    @Body()
    body: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      companyName?: string;
      website?: string;
      sourceName?: string;
    },
  ) {
    const auth = req.headers.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
    return this.apiKeys.ingestLead(token, body);
  }
}
