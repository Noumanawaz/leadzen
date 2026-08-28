import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { UsageModule } from '../usage/usage.module';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import { WhatsAppIntegrationService } from './whatsapp-integration.service';
import { WhatsAppQueueService } from './whatsapp-queue.service';
import { WhatsAppTemplateService } from './whatsapp-template.service';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

@Module({
  imports: [CreditsModule, UsageModule, EntitlementsModule],
  controllers: [WhatsAppWebhookController],
  providers: [
    MetaWhatsAppProvider,
    WhatsAppIntegrationService,
    WhatsAppWebhookService,
    WhatsAppQueueService,
    WhatsAppTemplateService,
  ],
  exports: [
    MetaWhatsAppProvider,
    WhatsAppIntegrationService,
    WhatsAppTemplateService,
  ],
})
export class WhatsAppModule {}
