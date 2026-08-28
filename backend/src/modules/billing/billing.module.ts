import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CreditsModule } from '../credits/credits.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

@Module({
  imports: [CreditsModule, AuditModule],
  controllers: [BillingController],
  providers: [StripeService, BillingService],
  exports: [StripeService, BillingService],
})
export class BillingModule {}
