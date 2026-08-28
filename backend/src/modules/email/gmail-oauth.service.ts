import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import { JwtService } from '@nestjs/jwt';
import type { AppEnv } from '../../config/env.validation';
import {
  decryptSecret,
  encryptSecret,
} from '../../common/encryption/token-encryption';
import type {
  EmailProvider,
  SendEmailInput,
  SendEmailResult,
} from '../outreach/providers.types';

export type GmailTokens = {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
};

@Injectable()
export class GmailOAuthService {
  private readonly logger = new Logger(GmailOAuthService.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwt: JwtService,
  ) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }) &&
        this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
    );
  }

  private oauthClient() {
    return new google.auth.OAuth2(
      this.config.get('GOOGLE_CLIENT_ID', { infer: true }),
      this.config.get('GOOGLE_CLIENT_SECRET', { infer: true }),
      this.config.get('GOOGLE_REDIRECT_URI', { infer: true }),
    );
  }

  async createConnectUrl(organizationId: string, userId: string) {
    if (!this.isConfigured()) {
      throw new Error('Google OAuth is not configured');
    }
    const state = await this.jwt.signAsync(
      { organizationId, userId, purpose: 'gmail_oauth' },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: '15m',
      },
    );
    const client = this.oauthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });
    return { url, state };
  }

  async verifyState(state: string): Promise<{
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
    if (payload.purpose !== 'gmail_oauth') {
      throw new Error('Invalid OAuth state');
    }
    return {
      organizationId: payload.organizationId,
      userId: payload.userId,
    };
  }

  async exchangeCode(code: string): Promise<{
    tokens: GmailTokens;
    email: string;
  }> {
    const client = this.oauthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const me = await oauth2.userinfo.get();
    const email = me.data.email;
    if (!email) {
      throw new Error('Could not resolve Gmail address');
    }
    return {
      tokens: tokens as GmailTokens,
      email,
    };
  }

  encryptTokens(tokens: GmailTokens): string {
    const key = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!key) {
      throw new Error('TOKEN_ENCRYPTION_KEY is required');
    }
    return encryptSecret(JSON.stringify(tokens), key);
  }

  decryptTokens(payload: string): GmailTokens {
    const key = this.config.get('TOKEN_ENCRYPTION_KEY', { infer: true });
    if (!key) {
      throw new Error('TOKEN_ENCRYPTION_KEY is required');
    }
    return JSON.parse(decryptSecret(payload, key)) as GmailTokens;
  }

  createEmailProvider(encryptedCredentials: string): EmailProvider {
    const tokens = this.decryptTokens(encryptedCredentials);
    const client = this.oauthClient();
    client.setCredentials(tokens);

    client.on('tokens', (fresh) => {
      this.logger.debug(`Gmail token refresh observed: ${Boolean(fresh.access_token)}`);
    });

    return {
      send: async (input: SendEmailInput): Promise<SendEmailResult> => {
        const gmail = google.gmail({ version: 'v1', auth: client });
        const raw = [
          `To: ${input.to}`,
          `Subject: ${input.subject}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          input.bodyText,
        ].join('\r\n');

        const encoded = Buffer.from(raw)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '');

        const result = await gmail.users.messages.send({
          userId: 'me',
          requestBody: { raw: encoded },
        });

        return {
          providerMessageId: result.data.id ?? `gmail_${Date.now()}`,
          threadId: result.data.threadId ?? undefined,
        };
      },
    };
  }
}
