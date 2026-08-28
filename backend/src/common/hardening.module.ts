import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ObservabilityService } from './observability/observability.service';
import { RateLimitGuard } from './rate-limit/rate-limit.guard';

@Global()
@Module({
  providers: [
    ObservabilityService,
    RateLimitGuard,
    { provide: APP_GUARD, useExisting: RateLimitGuard },
  ],
  exports: [ObservabilityService, RateLimitGuard],
})
export class HardeningModule {}
