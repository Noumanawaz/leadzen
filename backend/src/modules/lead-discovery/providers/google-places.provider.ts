import {
  BadRequestException,
  Injectable,
  Logger,
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

type PlacesSearchInput = {
  textQuery: string;
  maxResultCount?: number;
  locationBias?: { latitude: number; longitude: number; radiusMeters?: number };
};

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  rating?: number;
  location?: { latitude?: number; longitude?: number };
};

@Injectable()
export class GooglePlacesProvider {
  private readonly logger = new Logger(GooglePlacesProvider.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly prisma: PrismaService,
  ) {}

  async status(organizationId: string) {
    const platformKey = Boolean(
      this.config.get('GOOGLE_PLACES_API_KEY', { infer: true }),
    );
    const enabled = this.config.get('GOOGLE_PLACES_ENABLED', { infer: true });
    const orgAccount = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.google_places,
        status: 'active',
      },
      select: { id: true, label: true, status: true },
    });
    return {
      enabled,
      platformKeyConfigured: platformKey,
      orgOverride: orgAccount
        ? { id: orgAccount.id, label: orgAccount.label, status: orgAccount.status }
        : null,
      ready: enabled && (platformKey || Boolean(orgAccount)),
    };
  }

  async connectOrgKey(
    organizationId: string,
    apiKey: string,
    label = 'Google Places',
  ) {
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!encKey) {
      throw new ServiceUnavailableException('TOKEN_ENCRYPTION_KEY not configured');
    }
    const encrypted = encryptSecret(JSON.stringify({ apiKey }), encKey);
    const existing = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.google_places,
      },
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
        provider: ConnectedAccountProvider.google_places,
        label,
        encryptedCredentials: encrypted,
        status: 'active',
      },
      select: { id: true, label: true, provider: true, status: true },
    });
  }

  async search(
    organizationId: string,
    input: PlacesSearchInput,
  ): Promise<NormalizedLead[]> {
    const apiKey = await this.resolveApiKey(organizationId);
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Google Places is not configured. Set GOOGLE_PLACES_API_KEY or connect an org key.',
      );
    }

    const body: Record<string, unknown> = {
      textQuery: input.textQuery,
      maxResultCount: Math.min(input.maxResultCount ?? 20, 20),
    };
    if (input.locationBias) {
      body.locationBias = {
        circle: {
          center: {
            latitude: input.locationBias.latitude,
            longitude: input.locationBias.longitude,
          },
          radius: input.locationBias.radiusMeters ?? 5000,
        },
      };
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.types,places.rating,places.location',
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      this.logger.warn(`Places search failed: ${response.status} ${text}`);
      throw new BadRequestException(
        `Google Places search failed (${response.status})`,
      );
    }

    const json = (await response.json()) as { places?: PlaceResult[] };
    const places = json.places ?? [];

    await this.prisma.providerUsageEvent.create({
      data: {
        organizationId,
        provider: 'google_places',
        endpoint: 'places:searchText',
        quantity: places.length || 1,
        metadata: { textQuery: input.textQuery },
      },
    });

    return places.map((place) => this.normalize(place));
  }

  normalize(place: PlaceResult): NormalizedLead {
    const name = place.displayName?.text ?? 'Unknown business';
    const address = place.formattedAddress ?? '';
    const parts = address.split(',').map((p) => p.trim());
    return {
      companyName: name,
      firstName: null,
      lastName: null,
      phone:
        place.internationalPhoneNumber ?? place.nationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      city: parts.length >= 2 ? parts[parts.length - 3] ?? null : null,
      state: parts.length >= 2 ? parts[parts.length - 2] ?? null : null,
      country: parts.length >= 1 ? parts[parts.length - 1] ?? null : null,
      sourceType: 'google_places',
      sourceExternalId: place.id ?? null,
      sourceName: 'Google Places',
      sourceMetadata: {
        placeId: place.id,
        formattedAddress: place.formattedAddress,
        types: place.types,
        rating: place.rating,
        location: place.location,
      },
      leadScoreHint: place.rating ? Math.round(place.rating * 10) : 0,
    };
  }

  private async resolveApiKey(organizationId: string): Promise<string | null> {
    const orgAccount = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.google_places,
        status: 'active',
        encryptedCredentials: { not: null },
      },
    });
    const encKey = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (orgAccount?.encryptedCredentials && encKey) {
      try {
        const raw = decryptSecret(orgAccount.encryptedCredentials, encKey);
        const parsed = JSON.parse(raw) as { apiKey?: string };
        if (parsed.apiKey) return parsed.apiKey;
      } catch {
        this.logger.warn('Failed to decrypt org Google Places key');
      }
    }
    return this.config.get('GOOGLE_PLACES_API_KEY', { infer: true }) || null;
  }
}
