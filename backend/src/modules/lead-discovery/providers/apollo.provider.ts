import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConnectedAccountProvider } from '../../../../generated/prisma/client';
import type { AppEnv } from '../../../config/env.validation';
import {
  decryptSecret,
  encryptSecret,
} from '../../../common/encryption/token-encryption';
import { PrismaService } from '../../../database/prisma.service';
import type { NormalizedLead } from '../lead-source.types';

@Injectable()
export class ApolloProvider {
  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly prisma: PrismaService,
  ) {}

  async status(organizationId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.apollo,
      },
      select: { id: true, label: true, status: true },
    });
    return {
      connected: Boolean(account && account.status === 'active'),
      account: account
        ? { id: account.id, label: account.label, status: account.status }
        : null,
    };
  }

  async connect(organizationId: string, apiKey: string, label = 'Apollo') {
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!encKey) {
      throw new ServiceUnavailableException('TOKEN_ENCRYPTION_KEY not configured');
    }
    const encrypted = encryptSecret(JSON.stringify({ apiKey }), encKey);
    const existing = await this.prisma.connectedAccount.findFirst({
      where: { organizationId, provider: ConnectedAccountProvider.apollo },
    });
    if (existing) {
      return this.prisma.connectedAccount.update({
        where: { id: existing.id },
        data: {
          label,
          encryptedCredentials: encrypted,
          status: 'active',
        },
        select: { id: true, label: true, provider: true, status: true },
      });
    }
    return this.prisma.connectedAccount.create({
      data: {
        organizationId,
        provider: ConnectedAccountProvider.apollo,
        label,
        encryptedCredentials: encrypted,
        status: 'active',
      },
      select: { id: true, label: true, provider: true, status: true },
    });
  }

  async disconnect(organizationId: string) {
    await this.prisma.connectedAccount.deleteMany({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.apollo,
      },
    });
    return { ok: true };
  }

  async search(
    organizationId: string,
    filters: {
      qKeywords?: string;
      personTitles?: string[];
      personLocations?: string[];
      page?: number;
    },
  ): Promise<NormalizedLead[]> {
    const apiKey = await this.resolveApiKey(organizationId);
    if (!apiKey) {
      throw new ServiceUnavailableException('Connect Apollo with an API key first');
    }

    const response = await fetch('https://api.apollo.io/api/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_keywords: filters.qKeywords,
        person_titles: filters.personTitles,
        person_locations: filters.personLocations,
        page: filters.page ?? 1,
        per_page: 25,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceUnavailableException(
        `Apollo search failed (${response.status}): ${text.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as {
      people?: Array<Record<string, unknown>>;
    };

    await this.prisma.providerUsageEvent.create({
      data: {
        organizationId,
        provider: 'apollo',
        endpoint: 'mixed_people/search',
        quantity: json.people?.length ?? 0,
      },
    });

    return (json.people ?? []).map((person) => this.normalize(person));
  }

  normalize(person: Record<string, unknown>): NormalizedLead {
    const org = (person.organization ?? {}) as Record<string, unknown>;
    return {
      firstName: (person.first_name as string) ?? null,
      lastName: (person.last_name as string) ?? null,
      email: (person.email as string) ?? null,
      phone:
        (person.sanitized_phone as string) ??
        (person.phone_number as string) ??
        null,
      jobTitle: (person.title as string) ?? null,
      website: (org.website_url as string) ?? null,
      companyName: (org.name as string) ?? null,
      city: (person.city as string) ?? null,
      state: (person.state as string) ?? null,
      country: (person.country as string) ?? null,
      sourceType: 'apollo',
      sourceExternalId: (person.id as string) ?? null,
      sourceName: 'Apollo',
      sourceMetadata: {
        linkedinUrl: person.linkedin_url,
        organizationId: org.id,
      },
    };
  }

  private async resolveApiKey(organizationId: string): Promise<string | null> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.apollo,
        status: 'active',
        encryptedCredentials: { not: null },
      },
    });
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!account?.encryptedCredentials || !encKey) return null;
    try {
      const raw = decryptSecret(account.encryptedCredentials, encKey);
      const parsed = JSON.parse(raw) as { apiKey?: string };
      return parsed.apiKey ?? null;
    } catch {
      return null;
    }
  }
}
