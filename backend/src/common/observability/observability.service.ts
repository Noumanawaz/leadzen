import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation';

/**
 * Observability hooks — no-op unless SENTRY_DSN / OTEL_ENABLED are set.
 * Keeps a single place to wire real SDKs later without scattering try/catch.
 */
@Injectable()
export class ObservabilityService {
  private readonly logger = new Logger(ObservabilityService.name);
  private readonly sentryEnabled: boolean;
  private readonly otelEnabled: boolean;

  constructor(config: ConfigService<AppEnv, true>) {
    this.sentryEnabled = Boolean(config.get('SENTRY_DSN', { infer: true }));
    this.otelEnabled = Boolean(config.get('OTEL_ENABLED', { infer: true }));
    if (this.sentryEnabled) {
      this.logger.log('Sentry DSN configured (hook ready; SDK not bundled)');
    }
    if (this.otelEnabled) {
      this.logger.log('OpenTelemetry enabled flag set (hook ready; SDK not bundled)');
    }
  }

  captureException(error: unknown, context?: Record<string, unknown>) {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(
      `exception: ${message}${context ? ` ${JSON.stringify(context)}` : ''}`,
    );
    // Future: Sentry.captureException(error, { extra: context })
  }

  captureMessage(message: string, context?: Record<string, unknown>) {
    this.logger.log(
      `event: ${message}${context ? ` ${JSON.stringify(context)}` : ''}`,
    );
  }

  startSpan(name: string): { end: () => void } {
    const started = Date.now();
    if (!this.otelEnabled) {
      return { end: () => undefined };
    }
    return {
      end: () => {
        this.logger.debug(`span:${name} ${Date.now() - started}ms`);
      },
    };
  }
}
