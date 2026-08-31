import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { CommonAuthModule } from './common/common-auth.module';
import { DatabaseModule } from './database/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CreditsModule } from './modules/credits/credits.module';
import { BillingModule } from './modules/billing/billing.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { HealthModule } from './modules/health/health.module';
import { LeadsModule } from './modules/leads/leads.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { OutreachModule } from './modules/outreach/outreach.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { AiModule } from './modules/ai/ai.module';
import { AdminModule } from './modules/admin/admin.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { PrivacyModule } from './modules/privacy/privacy.module';
import { CalendarModule } from './modules/calendar/calendar.module';
import { HardeningModule } from './common/hardening.module';
import { UsageModule } from './modules/usage/usage.module';
import { LeadDiscoveryModule } from './modules/lead-discovery/lead-discovery.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    CommonAuthModule,
    HardeningModule,
    HealthModule,
    PermissionsModule,
    AuditModule,
    CreditsModule,
    UsageModule,
    EntitlementsModule,
    AuthModule,
    OrganizationsModule,
    CompaniesModule,
    LeadsModule,
    PipelinesModule,
    BillingModule,
    OutreachModule,
    WhatsAppModule,
    AiModule,
    AdminModule,
    FeatureFlagsModule,
    PrivacyModule,
    CalendarModule,
    LeadDiscoveryModule,
    DashboardModule,
  ],
})
export class AppModule {}
