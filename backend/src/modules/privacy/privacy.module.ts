import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OutreachModule } from '../outreach/outreach.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

@Module({
  imports: [AuditModule, OutreachModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
