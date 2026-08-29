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

export type WabaProfile = { id: string; name: string };

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

  private authHeaders(accessToken: string) {
    return { Authorization: `Bearer ${accessToken}` };
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
      this.graphUrl(
        `/${credentials.phoneNumberId}?fields=display_phone_number,verified_name`,
      ),
      { headers: this.authHeaders(credentials.accessToken) },
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

  async fetchWabaProfile(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
  ): Promise<WabaProfile> {
    const res = await fetch(this.graphUrl(`/${wabaId}?fields=id,name`), {
      headers: this.authHeaders(credentials.accessToken),
    });
    const payload = (await res.json()) as {
      id?: string;
      name?: string;
      error?: GraphError;
    };
    if (!res.ok || !payload.id) {
      throw new BadRequestException(
        mapMetaError(payload.error) ??
          'Could not verify WhatsApp Business Account.',
      );
    }
    return { id: payload.id, name: payload.name ?? 'WhatsApp Business' };
  }

  async listWabaPhoneNumberIds(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
  ): Promise<string[]> {
    const res = await fetch(
      this.graphUrl(`/${wabaId}/phone_numbers?fields=id`),
      { headers: this.authHeaders(credentials.accessToken) },
    );
    const payload = (await res.json()) as {
      data?: Array<{ id?: string }>;
      error?: GraphError;
    };
    if (!res.ok) {
      throw new BadRequestException(
        mapMetaError(payload.error) ??
          'Could not verify WhatsApp phone numbers for this account.',
      );
    }
    return (payload.data ?? [])
      .map((row) => row.id)
      .filter((id): id is string => Boolean(id));
  }

  async verifyPhoneBelongsToWaba(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
    phoneNumberId: string,
  ): Promise<void> {
    const phoneIds = await this.listWabaPhoneNumberIds(credentials, wabaId);
    if (!phoneIds.includes(phoneNumberId)) {
      throw new BadRequestException(
        'WhatsApp phone number could not be verified for this business account.',
      );
    }
  }

  async resolveWabaForPhoneNumber(
    credentials: WhatsAppEncryptedCredentials,
    phoneNumberId: string,
    hintedWabaId?: string,
  ): Promise<string> {
    if (hintedWabaId) {
      await this.fetchWabaProfile(credentials, hintedWabaId);
      await this.verifyPhoneBelongsToWaba(
        credentials,
        hintedWabaId,
        phoneNumberId,
      );
      return hintedWabaId;
    }

    throw new BadRequestException(
      'WhatsApp Business Account ID was not returned by Meta. Please try connecting again.',
    );
  }

  async subscribeWabaToApp(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
  ): Promise<void> {
    const res = await fetch(this.graphUrl(`/${wabaId}/subscribed_apps`), {
      method: 'POST',
      headers: this.authHeaders(credentials.accessToken),
    });
    if (!res.ok) {
      const payload = (await res.json()) as { error?: GraphError };
      this.logger.warn(
        `whatsapp.waba.subscribe.failed wabaId=${wabaId}: ${payload.error?.message ?? res.statusText}`,
      );
    }
  }

  async unsubscribeWabaFromApp(
    credentials: WhatsAppEncryptedCredentials,
    wabaId: string,
  ): Promise<void> {
    const res = await fetch(this.graphUrl(`/${wabaId}/subscribed_apps`), {
      method: 'DELETE',
      headers: this.authHeaders(credentials.accessToken),
    });
    if (!res.ok) {
      const payload = (await res.json()) as { error?: GraphError };
      this.logger.warn(
        `whatsapp.waba.unsubscribe.failed wabaId=${wabaId}: ${payload.error?.message ?? res.statusText}`,
      );
    }
  }

  isAuthError(error?: GraphError): boolean {
    return error?.code === 190 || error?.code === 102;
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
          ...this.authHeaders(credentials.accessToken),
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
        authError: this.isAuthError(payload.error),
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
      { headers: this.authHeaders(credentials.accessToken) },
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

export function extractWhatsAppWebhookEventIds(payload: {
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: Array<{ id: string }>;
        statuses?: Array<{ id: string; status: string }>;
      };
    }>;
  }>;
}): string[] {
  const ids: string[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      for (const msg of value?.messages ?? []) {
        ids.push(
          phoneNumberId
            ? `${phoneNumberId}:message:${msg.id}`
            : `message:${msg.id}`,
        );
      }
      for (const status of value?.statuses ?? []) {
        ids.push(
          phoneNumberId
            ? `${phoneNumberId}:status:${status.id}:${status.status}`
            : `status:${status.id}:${status.status}`,
        );
      }
    }
    if (!ids.length && entry.id) {
      ids.push(`waba:${entry.id}`);
    }
  }
  return ids;
}
