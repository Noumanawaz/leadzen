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
import { mapMetaError, MetaWhatsAppProvider } from './meta-whatsapp.provider';
import type {
  WhatsAppAccountMetadata,
  WhatsAppEncryptedCredentials,
  WhatsAppIntegrationSummary,
  WhatsAppPlatformSetupStatus,
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

  private missingPlatformEnvVars(): string[] {
    const missing: string[] = [];
    if (!this.config.get('META_APP_ID', { infer: true })) {
      missing.push('META_APP_ID');
    }
    if (!this.config.get('META_APP_SECRET', { infer: true })) {
      missing.push('META_APP_SECRET');
    }
    if (!this.config.get('META_EMBEDDED_SIGNUP_CONFIG_ID', { infer: true })) {
      missing.push('META_EMBEDDED_SIGNUP_CONFIG_ID');
    }
    if (!this.config.get('META_WEBHOOK_VERIFY_TOKEN', { infer: true })) {
      missing.push('META_WEBHOOK_VERIFY_TOKEN');
    }
    if (!this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true })) {
      missing.push('TOKEN_ENCRYPTION_KEY');
    }
    return missing;
  }

  getPlatformSetupStatus(): WhatsAppPlatformSetupStatus {
    const appId = this.config.get('META_APP_ID', { infer: true });
    const messagingConfigured = this.meta.isAppConfigured();
    const embeddedSignupConfigured = this.meta.isPlatformConfigured();
    const tokenEncryptionConfigured = Boolean(
      this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true }),
    );
    const missingEnvVars = this.missingPlatformEnvVars();
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    const port = this.config.get('PORT', { infer: true });
    const graphApiVersion = this.meta.graphVersion();

    return {
      embeddedSignupConfigured,
      messagingConfigured,
      tokenEncryptionConfigured,
      missingEnvVars,
      webhookPath: '/api/webhooks/whatsapp',
      appId: appId || undefined,
      graphApiVersion,
      devManualConnectAvailable:
        nodeEnv === 'development' &&
        messagingConfigured &&
        tokenEncryptionConfigured &&
        !embeddedSignupConfigured,
      setupSteps: [
        'Create a Meta app at developers.facebook.com and add the WhatsApp product.',
        'Configure Facebook Login for Business → Embedded Signup and copy the Configuration ID into META_EMBEDDED_SIGNUP_CONFIG_ID.',
        'Set META_APP_ID and META_APP_SECRET from the Meta app dashboard.',
        'Set META_WEBHOOK_VERIFY_TOKEN and register webhook URL (see below) with messages subscribed.',
        `Local dev: expose port ${port} via ngrok and use https://YOUR_TUNNEL${'/api/webhooks/whatsapp'}.`,
      ],
    };
  }

  getPublicConfig(): WhatsAppPublicConfig {
    const appId = this.config.get('META_APP_ID', { infer: true });
    const configId = this.config.get('META_EMBEDDED_SIGNUP_CONFIG_ID', {
      infer: true,
    });
    const setup = this.getPlatformSetupStatus();
    return {
      configured: setup.embeddedSignupConfigured,
      messagingConfigured: setup.messagingConfigured,
      embeddedSignupConfigured: setup.embeddedSignupConfigured,
      appId: appId || undefined,
      configId: configId || undefined,
      missingEnvVars: setup.missingEnvVars,
      devManualConnectAvailable: setup.devManualConnectAvailable,
      graphApiVersion: setup.graphApiVersion,
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
      phoneNumberId: params.phoneNumberId.trim(),
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000).toISOString()
        : undefined,
    };

    const verifiedWabaId = await this.meta.resolveWabaForPhoneNumber(
      credentials,
      credentials.phoneNumberId,
      params.wabaId?.trim(),
    );
    const wabaProfile = await this.meta.fetchWabaProfile(
      credentials,
      verifiedWabaId,
    );
    const profile = await this.meta.fetchPhoneNumberProfile(credentials);
    const now = new Date().toISOString();

    const metadata: WhatsAppAccountMetadata = {
      wabaId: verifiedWabaId,
      businessId: params.businessId?.trim(),
      phoneNumber: profile.displayPhoneNumber,
      displayName: wabaProfile.name || profile.verifiedName,
      graphApiVersion: this.meta.graphVersion(),
      connectedAt: now,
      connectionMethod: 'embedded_signup',
      lastVerifiedAt: now,
      tokenExpiresAt: credentials.tokenExpiresAt,
    };

    const account = await this.saveConnectedAccount({
      organizationId: params.organizationId,
      phoneNumberId: credentials.phoneNumberId,
      credentials,
      metadata,
      label: metadata.displayName || profile.displayPhoneNumber,
    });

    void this.meta
      .subscribeWabaToApp(credentials, verifiedWabaId)
      .catch(() => undefined);

    return account;
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

    let verifiedWabaId = params.wabaId?.trim();
    if (verifiedWabaId) {
      await this.meta.verifyPhoneBelongsToWaba(
        credentials,
        verifiedWabaId,
        credentials.phoneNumberId,
      );
    }

    const profile = await this.meta.fetchPhoneNumberProfile(credentials);
    const now = new Date().toISOString();
    const metadata: WhatsAppAccountMetadata = {
      wabaId: verifiedWabaId,
      phoneNumber: profile.displayPhoneNumber,
      displayName: profile.verifiedName,
      graphApiVersion: this.meta.graphVersion(),
      connectedAt: now,
      connectionMethod: 'manual_legacy',
      lastVerifiedAt: now,
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
      const errored = await this.prisma.connectedAccount.findFirst({
        where: {
          organizationId,
          provider: ConnectedAccountProvider.meta_whatsapp,
          status: ConnectedAccountStatus.error,
        },
      });
      if (errored) {
        await this.clearAccountCredentials(errored.id, errored.metadata);
        return { disconnected: true };
      }
      throw new NotFoundException('WhatsApp is not connected');
    }

    const metadata = (account.metadata as WhatsAppAccountMetadata | null) ?? {};
    if (metadata.wabaId && account.encryptedCredentials) {
      const credentials = this.decryptCredentials(account.encryptedCredentials);
      if (credentials) {
        void this.meta
          .unsubscribeWabaFromApp(credentials, metadata.wabaId)
          .catch(() => undefined);
      }
    }

    await this.clearAccountCredentials(account.id, account.metadata);
    this.logger.log(
      `whatsapp.integration.disconnected tenantId=${organizationId} integrationId=${account.id}`,
    );
    return { disconnected: true };
  }

  private async clearAccountCredentials(
    accountId: string,
    metadata: unknown,
  ) {
    await this.prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: ConnectedAccountStatus.disconnected,
        encryptedCredentials: null,
        metadata: {
          ...((metadata as WhatsAppAccountMetadata | null) ?? {}),
          disconnectedAt: new Date().toISOString(),
        },
      },
    });
  }

  async getIntegration(organizationId: string): Promise<WhatsAppIntegrationSummary> {
    const account = await this.findWhatsAppAccount(organizationId);
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
      lastVerifiedAt: summary.lastVerifiedAt,
      connectionMethod: summary.connectionMethod,
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
    if (!integration.connected && integration.status !== 'error') {
      throw new BadRequestException('WhatsApp is not connected');
    }

    const account = await this.findWhatsAppAccount(organizationId);
    if (!account?.encryptedCredentials) {
      throw new BadRequestException('WhatsApp is not connected');
    }

    try {
      const credentials = this.decryptCredentials(account.encryptedCredentials);
      if (!credentials) {
        throw new BadRequestException(
          'WhatsApp credentials could not be read. Please reconnect.',
        );
      }
      const profile = await this.meta.fetchPhoneNumberProfile(credentials);
      await this.markConnectionHealthy(account.id, account.metadata, profile);
      return {
        ok: true,
        phoneNumber: profile.displayPhoneNumber || integration.phoneNumber,
        displayName: profile.verifiedName || integration.displayName,
        lastVerifiedAt: new Date().toISOString(),
      };
    } catch (err) {
      await this.markConnectionError(organizationId, account.id, account.metadata);
      throw err;
    }
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

  private async findWhatsAppAccount(organizationId: string) {
    return this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: ConnectedAccountProvider.meta_whatsapp,
        status: {
          in: [ConnectedAccountStatus.active, ConnectedAccountStatus.error],
        },
      },
      orderBy: { updatedAt: 'desc' },
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
      const errored = await this.prisma.connectedAccount.findFirst({
        where: {
          organizationId,
          provider: ConnectedAccountProvider.meta_whatsapp,
          status: ConnectedAccountStatus.error,
        },
      });
      if (errored) {
        throw new BadRequestException(
          'WhatsApp connection requires attention. Reconnect in Integrations.',
        );
      }
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
    if (
      credentials.tokenExpiresAt &&
      new Date(credentials.tokenExpiresAt).getTime() < Date.now()
    ) {
      await this.markConnectionError(organizationId, account.id, account.metadata);
      throw new BadRequestException(
        'WhatsApp connection expired. Please reconnect your WhatsApp Business account.',
      );
    }
    return {
      accountId: account.id,
      credentials,
      metadata: (account.metadata as WhatsAppAccountMetadata | null) ?? {},
    };
  }

  async markConnectionError(
    organizationId: string,
    accountId: string,
    metadata: unknown,
  ) {
    await this.prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: ConnectedAccountStatus.error,
        metadata: {
          ...((metadata as WhatsAppAccountMetadata | null) ?? {}),
          lastErrorAt: new Date().toISOString(),
        },
      },
    });
    this.logger.warn(
      `whatsapp.integration.error tenantId=${organizationId} integrationId=${accountId}`,
    );
  }

  private async markConnectionHealthy(
    accountId: string,
    metadata: unknown,
    profile: { displayPhoneNumber: string; verifiedName: string },
  ) {
    const now = new Date().toISOString();
    await this.prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: ConnectedAccountStatus.active,
        metadata: {
          ...((metadata as WhatsAppAccountMetadata | null) ?? {}),
          phoneNumber: profile.displayPhoneNumber,
          displayName: profile.verifiedName,
          lastVerifiedAt: now,
        },
      },
    });
  }

  async handleSendAuthFailure(organizationId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { id: accountId, organizationId },
    });
    if (!account) return;
    await this.markConnectionError(organizationId, accountId, account.metadata);
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
    const status = this.mapAccountStatus(account.status);
    return {
      connected: status === 'connected',
      status,
      phoneNumber: metadata.phoneNumber,
      displayName: metadata.displayName,
      phoneNumberId: account.externalAccountId ?? undefined,
      wabaId: metadata.wabaId,
      connectedAccountId: account.id,
      lastVerifiedAt: metadata.lastVerifiedAt,
      connectionMethod: metadata.connectionMethod,
    };
  }

  private mapAccountStatus(
    status: ConnectedAccountStatus,
  ): WhatsAppIntegrationSummary['status'] {
    if (status === ConnectedAccountStatus.active) return 'connected';
    if (status === ConnectedAccountStatus.error) return 'requires_reconnect';
    if (status === ConnectedAccountStatus.pending) return 'pending';
    return 'disconnected';
  }

  mapMetaErrorMessage(error?: { message?: string; code?: number }) {
    return mapMetaError(error);
  }
}
