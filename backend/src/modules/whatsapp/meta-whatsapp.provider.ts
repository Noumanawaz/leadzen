import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppEnv } from '../../config/env.validation';
import type {
  SendWhatsAppMediaInput,
  SendWhatsAppResult,
  SendWhatsAppTemplateInput,
  SendWhatsAppTextInput,
  WhatsAppProvider,
} from '../outreach/providers.types';
import type { WhatsAppEncryptedCredentials } from './whatsapp.types';

type GraphError = { message?: string; code?: number; error_subcode?: number };

@Injectable()
export class MetaWhatsAppProvider implements WhatsAppProvider {
  private readonly logger = new Logger(MetaWhatsAppProvider.name);

  constructor(private readonly config: ConfigService<AppEnv, true>) {}

  isAppConfigured(): boolean {
    return Boolean(
      this.config.get('META_APP_ID', { infer: true }) &&
        this.config.get('META_APP_SECRET', { infer: true }),
    );
  }

  isPlatformConfigured(): boolean {
    return Boolean(
      this.isAppConfigured() &&
        this.config.get('META_EMBEDDED_SIGNUP_CONFIG_ID', { infer: true }),
    );
  }

  graphVersion(): string {
    return this.config.get('META_GRAPH_API_VERSION', { infer: true }) || 'v22.0';
  }

  private graphUrl(path: string): string {
    return `https://graph.facebook.com/${this.graphVersion()}${path}`;
  }

  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    expiresIn?: number;
  }> {
    const appId = this.config.get('META_APP_ID', { infer: true });
    const appSecret = this.config.get('META_APP_SECRET', { infer: true });
    if (!appId || !appSecret) {
      throw new BadRequestException(
        'Meta app is not configured on the server',
      );
    }

    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      code,
    });
    const res = await fetch(
      this.graphUrl(`/oauth/access_token?${params.toString()}`),
    );
    const payload = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
      error?: GraphError;
    };
    if (!res.ok || !payload.access_token) {
      this.logger.warn(
        `whatsapp.token.exchange.failed: ${payload.error?.message ?? res.statusText}`,
      );
      throw new BadRequestException(
        'Could not complete WhatsApp connection. Please try again.',
      );
    }
    return {
      accessToken: payload.access_token,
      expiresIn: payload.expires_in,
    };
  }

  async fetchPhoneNumberProfile(
    credentials: WhatsAppEncryptedCredentials,
  ): Promise<{ displayPhoneNumber: string; verifiedName: string }> {
    const res = await fetch(
      this.graphUrl(`/${credentials.phoneNumberId}?fields=display_phone_number,verified_name`),
      { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
    );
    const payload = (await res.json()) as {
      display_phone_number?: string;
      verified_name?: string;
      error?: GraphError;
    };
    if (!res.ok) {
      throw new BadRequestException(
        mapMetaError(payload.error) ??
          'Could not verify WhatsApp phone number.',
      );
    }
    return {
      displayPhoneNumber: payload.display_phone_number ?? '',
      verifiedName: payload.verified_name ?? 'WhatsApp Business',
    };
  }

  async sendTextMessage(
    input: SendWhatsAppTextInput,
    credentials: WhatsAppEncryptedCredentials,
  ): Promise<SendWhatsAppResult> {
    return this.postMessage(credentials, {
      messaging_product: 'whatsapp',
      to: input.toE164.replace(/^\+/, ''),
      type: 'text',
      text: { body: input.body },
    });
  }

  async sendTemplateMessage(
    input: SendWhatsAppTemplateInput,
    credentials: WhatsAppEncryptedCredentials,
  ): Promise<SendWhatsAppResult> {
    return this.postMessage(credentials, {
      messaging_product: 'whatsapp',
      to: input.toE164.replace(/^\+/, ''),
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: input.language },
        components: input.components,
      },
    });
  }

  async sendMediaMessage(
    input: SendWhatsAppMediaInput,
    credentials: WhatsAppEncryptedCredentials,
  ): Promise<SendWhatsAppResult> {
    return this.postMessage(credentials, {
      messaging_product: 'whatsapp',
      to: input.toE164.replace(/^\+/, ''),
      type: input.mediaType,
      [input.mediaType]: {
        link: input.link,
        caption: input.caption,
      },
    });
  }

  private async postMessage(
    credentials: WhatsAppEncryptedCredentials,
    body: Record<string, unknown>,
  ): Promise<SendWhatsAppResult> {
    const res = await fetch(
      this.graphUrl(`/${credentials.phoneNumberId}/messages`),
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const payload = (await res.json()) as {
      messages?: Array<{ id: string }>;
      error?: GraphError;
    };
    if (!res.ok) {
      const friendly = mapMetaError(payload.error);
      this.logger.warn(
        `whatsapp.message.failed: ${payload.error?.message ?? res.statusText}`,
      );
      return {
        providerMessageId: '',
        status: 'failed',
        error: friendly ?? 'WhatsApp message could not be sent.',
      };
    }
    return {
      providerMessageId: payload.messages?.[0]?.id ?? '',
      status: 'sent',
    };
  }

  async listMessageTemplates(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      language: string;
      status: string;
      category?: string;
      components?: unknown;
    }>
  > {
    const res = await fetch(
      this.graphUrl(
        `/${wabaId}/message_templates?fields=name,language,status,category,components`,
      ),
      { headers: { Authorization: `Bearer ${credentials.accessToken}` } },
    );
    const payload = (await res.json()) as {
      data?: Array<{
        id: string;
        name: string;
        language: string;
        status: string;
        category?: string;
        components?: unknown;
      }>;
      error?: GraphError;
    };
    if (!res.ok) {
      throw new BadRequestException(
        mapMetaError(payload.error) ?? 'Could not load WhatsApp templates.',
      );
    }
    return payload.data ?? [];
  }
}

export function mapMetaError(error?: GraphError): string | undefined {
  if (!error?.message) return undefined;
  const code = error.code;
  if (code === 190 || code === 102) {
    return 'WhatsApp connection expired. Please reconnect your WhatsApp Business account.';
  }
  if (code === 131047) {
    return 'Outside the 24-hour messaging window. Use an approved template message.';
  }
  if (code === 131026) {
    return 'This recipient is not on WhatsApp or has an invalid number.';
  }
  return error.message;
}
