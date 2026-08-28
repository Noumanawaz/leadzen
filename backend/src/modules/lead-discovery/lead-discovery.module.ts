import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { DeduplicationService } from './deduplication.service';
import { ImportQueueService } from './import-queue.service';
import { CreditCostService } from './credit-cost.service';
import { CompanyContactUpsertService } from './company-contact-upsert.service';
import {
  LeadDiscoveryController,
  PublicLeadDiscoveryController,
} from './lead-discovery.controller';
import { LeadDiscoveryService } from './lead-discovery.service';
import { LeadFormsService } from './lead-forms.service';
import { LeadImportService } from './lead-import.service';
import { LeadScoringService } from './lead-scoring.service';
import { LeadValidationService } from './lead-validation.service';
import { ApolloProvider } from './providers/apollo.provider';
import { CsvProvider } from './providers/csv.provider';
import { GooglePlacesProvider } from './providers/google-places.provider';
import {
  OrganizationApiKeysService,
  ReferralLinksService,
} from './referral-api.service';

@Module({
  imports: [CreditsModule],
  controllers: [LeadDiscoveryController, PublicLeadDiscoveryController],
  providers: [
    LeadValidationService,
    DeduplicationService,
    LeadScoringService,
    CompanyContactUpsertService,
    LeadDiscoveryService,
    CreditCostService,
    CsvProvider,
    LeadImportService,
    ImportQueueService,
    GooglePlacesProvider,
    ApolloProvider,
    LeadFormsService,
    ReferralLinksService,
    OrganizationApiKeysService,
  ],
  exports: [LeadDiscoveryService, CreditCostService],
})
export class LeadDiscoveryModule {}
