import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { GmailOAuthService } from '../email/gmail-oauth.service';
import { SuppressionsService } from '../suppressions/suppressions.service';
import { UsageModule } from '../usage/usage.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { IntegrationsController } from './integrations.controller';
import { OutreachRouter } from './outreach.router';
import { PlaceholderPhoneProvider, PlaceholderSmsProvider } from './placeholder.providers';

@Module({
  imports: [CreditsModule, UsageModule, EntitlementsModule, WhatsAppModule],
  controllers: [IntegrationsController],
  providers: [
    GmailOAuthService,
    SuppressionsService,
    PlaceholderSmsProvider,
    PlaceholderPhoneProvider,
    OutreachRouter,
  ],
  exports: [OutreachRouter, GmailOAuthService, SuppressionsService],
})
export class OutreachModule {}
