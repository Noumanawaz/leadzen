import { Module } from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditsController } from './credits.controller';

@Module({
  controllers: [CreditsController],
  providers: [CreditService],
  exports: [CreditService],
})
export class CreditsModule {}
