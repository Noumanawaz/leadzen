import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { WhatsAppIntegrationService } from './whatsapp-integration.service';

@Injectable()
export class WhatsAppTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integration: WhatsAppIntegrationService,
    private readonly meta: MetaWhatsAppProvider,
  ) {}

  async listTemplates(organizationId: string) {
    const { accountId, credentials, metadata } =
      await this.integration.resolveCredentials(organizationId);
    const wabaId = metadata.wabaId;
    if (!wabaId) {
      return this.prisma.whatsAppTemplate.findMany({
        where: { organizationId },
        orderBy: { name: 'asc' },
      });
    }

    const remote = await this.meta.listMessageTemplates(credentials, wabaId);
    for (const tpl of remote) {
      await this.prisma.whatsAppTemplate.upsert({
        where: {
          connectedAccountId_name_language: {
            connectedAccountId: accountId,
            name: tpl.name,
            language: tpl.language,
          },
        },
        create: {
          organizationId,
          connectedAccountId: accountId,
          name: tpl.name,
          language: tpl.language,
          category: tpl.category ?? null,
          status: tpl.status,
          components: tpl.components as object | undefined,
          externalTemplateId: tpl.id,
        },
        update: {
          category: tpl.category ?? null,
          status: tpl.status,
          components: tpl.components as object | undefined,
          externalTemplateId: tpl.id,
        },
      });
    }

    return this.prisma.whatsAppTemplate.findMany({
      where: { organizationId, status: 'APPROVED' },
      orderBy: { name: 'asc' },
    });
  }
}
