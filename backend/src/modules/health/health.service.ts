import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  live() {
    return {
      status: 'ok' as const,
      service: 'lead-saas-api',
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const database = await this.prisma.isHealthy();
    if (!database) {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: { database: false },
      });
    }
    return {
      status: 'ok' as const,
      checks: { database: true },
      timestamp: new Date().toISOString(),
    };
  }
}
