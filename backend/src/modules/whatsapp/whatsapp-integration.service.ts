import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedAccountProvider,
  ConnectedAccountStatus,
} from '../../../generated/prisma/client';
import { decryptSecret, encryptSecret } from '../../common/encryption/token-encryption';
import type { AppEnv } from '../../config/env.validation';
import { PrismaService } from '../../database/prisma.service';
import { EntitlementService } from '../entitlements/entitlement.service';
import { MetaWhatsAppProvider } from './meta-whatsapp.provider';
import type {
  WhatsAppAccountMetadata,
  WhatsAppEncryptedCredentials,
  WhatsAppIntegrationSummary,
  WhatsAppPublicConfig,
} from './whatsapp.types';

@Injectable()
export class WhatsAppIntegrationService {
  private readonly logger = new Logger(WhatsAppIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwt: JwtService,
    private readonly meta: MetaWhatsAppProvider,
    private readonly entitlements: EntitlementService,
  ) {}

  getPublicConfig(): WhatsAppPublicConfig {
    const appId = this.config.get('META_APP_ID', { infer: true });
    const configId = this.config.get('META_EMBEDDED_SIGNUP_CONFIG_ID', {
      infer: true,
    });
    const messagingConfigured = this.meta.isAppConfigured();
    const embeddedSignupConfigured = this.meta.isPlatformConfigured();
    return {
      configured: embeddedSignupConfigured,
      messagingConfigured,
      embeddedSignupConfigured,
      appId: appId || undefined,
      configId: configId || undefined,
    };
  }

  async createConnectState(organizationId: string, userId: string) {
    if (!this.meta.isPlatformConfigured()) {
      throw new BadRequestException(
        'WhatsApp integration is not configured on this server. Contact your administrator.',
      );
    }
    const state = await this.jwt.signAsync(
      { organizationId, userId, purpose: 'whatsapp_embedded_signup' },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: '15m',
      },
    );
    return { state, ...this.getPublicConfig() };
  }

  async verifyConnectState(state: string): Promise<{
    organizationId: string;
    userId: string;
  }> {
    const payload = await this.jwt.verifyAsync<{
      organizationId: string;
      userId: string;
      purpose: string;
    }>(state, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
    if (payload.purpose !== 'whatsapp_embedded_signup') {
      throw new BadRequestException('Invalid WhatsApp connect state');
    }
    return {
      organizationId: payload.organizationId,
      userId: payload.userId,
    };
  }

  async completeConnect(params: {
    organizationId: string;
    state: string;
    code: string;
    phoneNumberId: string;
    wabaId?: string;
    businessId?: string;
  }) {
    const ctx = await this.verifyConnectState(params.state);
    if (ctx.organizationId !== params.organizationId) {
      throw new BadRequestException('Organization mismatch');
    }

    await this.entitlements.assertCanAddConnectedAccount(params.organizationId);

    const { accessToken, expiresIn } = await this.meta.exchangeCodeForToken(
      params.code,
    );
    const credentials: WhatsAppEncryptedCredentials = {
      accessToken,
      phoneNumberId: params.phoneNumberId,
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined,
    };

    const profile = await this.meta.fetchPhoneNumberProfile(credentials);
    const metadata: WhatsAppAccountMetadata = {
      wabaId: params.wabaId,
      businessId: params.businessId,
      phoneNumber: profile.displayPhoneNumber,
      displayName: profile.verifiedName,
      graphApiVersion: this.meta.graphVersion(),
      connectedAt: new Date().toISOString(),
    };

    return this.saveConnectedAccount({
      organizationId: params.organizationId,
      phoneNumberId: params.phoneNumberId,
      credentials,
      metadata,
      label: profile.verifiedName || profile.displayPhoneNumber,
    });
  }

  async manualConnect(
    organizationId: string,
    params: {
      accessToken: string;
      phoneNumberId: string;
      wabaId?: string;
    },
  ) {
    await this.entitlements.assertCanAddConnectedAccount(organizationId);

    const credentials: WhatsAppEncryptedCredentials = {
      accessToken: params.accessToken.trim(),
      phoneNumberId: params.phoneNumberId.trim(),
    };

    const profile = await this.meta.fetchPhoneNumberProfile(credentials);
    const metadata: WhatsAppAccountMetadata = {
      wabaId: params.wabaId?.trim() || undefined,
      phoneNumber: profile.displayPhoneNumber,
      displayName: profile.verifiedName,
      graphApiVersion: this.meta.graphVersion(),
      connectedAt: new Date().toISOString(),
    };

    return this.saveConnectedAccount({
      organizationId,
      phoneNumberId: params.phoneNumberId.trim(),
      credentials,
      metadata,
      label: profile.verifiedName || profile.displayPhoneNumber,
    });
  }

  private async saveConnectedAccount(params: {
    organizationId: string;
    phoneNumberId: string;
    credentials: WhatsAppEncryptedCredentials;
    metadata: WhatsAppAccountMetadata;
    label: string;
  }) {
    const encrypted = this.encryptCredentials(params.credentials);
    const label = params.label || 'WhatsApp Business';

    const existing = await this.prisma.connectedAccount.findFirst({
      where: {
        provider: ConnectedAccountProvider.meta_whatsapp,
        externalAccountId: params.phoneNumberId,
      },
    });

    if (
      existing &&
      existing.organizationId !== params.organizationId &&
      existing.status === ConnectedAccountStatus.active
    ) {
      throw new BadRequestException(
        'This WhatsApp phone number is already connected to another workspace.',
      );
    }

    const orgExisting = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId: params.organizationId,
        provider: ConnectedAccountProvider.meta_whatsapp,
      },
    });

    const account = orgExisting
      ? await this.prisma.connectedAccount.update({
          where: { id: orgExisting.id },
          data: {
            label,
            externalAccountId: params.phoneNumberId,
            encryptedCredentials: encrypted,
            metadata: params.metadata,
            status: ConnectedAccountStatus.active,
          },
        })
      : await this.prisma.connectedAccount.create({
          data: {
            organizationId: params.organizationId,
            provider: ConnectedAccountProvider.meta_whatsapp,
            label,
            externalAccountId: params.phoneNumberId,
            encryptedCredentials: encrypted,
            metadata: params.metadata,
            status: ConnectedAccountStatus.active,
          },
        });

    this.logger.log(
      `whatsapp.integration.connected tenantId=${params.organizationId} integrationId=${account.id}`,
    );

    return this.toSummary(account);
  }

  async disconnect(organizationId: string) {
    const account = await this.getActiveAccountRecord(organizationId);
    if (!account) {
      throw new NotFoundException('WhatsApp is not connected');
    }
    await this.prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        status: ConnectedAccountStatus.disconnected,
        encryptedCredentials: null,
      },
    });
    this.logger.log(
      `whatsapp.integration.disconnected tenantId=${organizationId} integrationId=${account.id}`,
    );
    return { disconnected: true };
  }

  async getIntegration(organizationId: string): Promise<WhatsAppIntegrationSummary> {
    const account = await this.getActiveAccountRecord(organizationId);
    if (!account) {
      return { connected: false, status: 'disconnected' };
    }
    return this.toSummary(account);
  }

  async getStatus(organizationId: string) {
    const summary = await this.getIntegration(organizationId);
    const publicConfig = this.getPublicConfig();
    return {
      connected: summary.connected,
      configured: publicConfig.messagingConfigured,
      embeddedSignupConfigured: publicConfig.embeddedSignupConfigured,
      status: summary.status,
      phoneNumber: summary.phoneNumber,
      displayName: summary.displayName,
      connectedAccount: summary.connected
        ? {
            id: summary.connectedAccountId!,
            label: summary.displayName ?? summary.phoneNumber ?? 'WhatsApp',
          }
        : null,
    };
  }

  async testConnection(organizationId: string) {
    const integration = await this.getIntegration(organizationId);
    if (!integration.connected) {
      throw new BadRequestException('WhatsApp is not connected');
    }
    const { credentials } = await this.resolveCredentials(organizationId);
    const profile = await this.meta.fetchPhoneNumberProfile(credentials);
    return {
      ok: true,
      phoneNumber: profile.displayPhoneNumber || integration.phoneNumber,
      displayName: profile.verifiedName || integration.displayName,
    };
  }

  async getActiveAccountRecord(organizationId: string) {
    return this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.meta_whatsapp,
        status: ConnectedAccountStatus.active,
      },
    });
  }

  async resolveCredentials(
    organizationId: string,
  ): Promise<{
    accountId: string;
    credentials: WhatsAppEncryptedCredentials;
    metadata: WhatsAppAccountMetadata;
  }> {
    const account = await this.getActiveAccountRecord(organizationId);
    if (!account?.encryptedCredentials) {
      throw new BadRequestException(
        'WhatsApp is not connected. Connect your WhatsApp Business account in Integrations.',
      );
    }
    const credentials = this.decryptCredentials(account.encryptedCredentials);
    if (!credentials) {
      throw new BadRequestException(
        'WhatsApp credentials could not be read. Please reconnect.',
      );
    }
    return {
      accountId: account.id,
      credentials,
      metadata: (account.metadata as WhatsAppAccountMetadata | null) ?? {},
    };
  }

  async findAccountByPhoneNumberId(phoneNumberId: string) {
    return this.prisma.connectedAccount.findFirst({
      where: {
        provider: ConnectedAccountProvider.meta_whatsapp,
        externalAccountId: phoneNumberId,
        status: ConnectedAccountStatus.active,
      },
    });
  }

  encryptCredentials(credentials: WhatsAppEncryptedCredentials): string {
    const key = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!key) {
      throw new BadRequestException('TOKEN_ENCRYPTION_KEY is required');
    }
    return encryptSecret(JSON.stringify(credentials), key);
  }

  decryptCredentials(encrypted: string): WhatsAppEncryptedCredentials | null {
    try {
      const key = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
      if (!key) return null;
      const parsed = JSON.parse(
        decryptSecret(encrypted, key),
      ) as WhatsAppEncryptedCredentials;
      if (!parsed.accessToken || !parsed.phoneNumberId) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  private toSummary(account: {
    id: string;
    status: ConnectedAccountStatus;
    metadata: unknown;
    externalAccountId: string | null;
  }): WhatsAppIntegrationSummary {
    const metadata = (account.metadata as WhatsAppAccountMetadata | null) ?? {};
    return {
      connected: account.status === ConnectedAccountStatus.active,
      status:
        account.status === ConnectedAccountStatus.active
          ? 'connected'
          : (account.status as WhatsAppIntegrationSummary['status']),
      phoneNumber: metadata.phoneNumber,
      displayName: metadata.displayName,
      phoneNumberId: account.externalAccountId ?? undefined,
      wabaId: metadata.wabaId,
      connectedAccountId: account.id,
    };
  }
}
