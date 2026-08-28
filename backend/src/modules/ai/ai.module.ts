import { Module } from '@nestjs/common';
import { CreditsModule } from '../credits/credits.module';
import { UsageModule } from '../usage/usage.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AI_PROVIDER } from './ai.types';
import { GroqProvider } from './groq.provider';

@Module({
  imports: [CreditsModule, UsageModule],
  controllers: [AiController],
  providers: [
    GroqProvider,
    { provide: AI_PROVIDER, useExisting: GroqProvider },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
