export type WhatsAppAccountMetadata = {
  wabaId?: string;
  businessId?: string;
  phoneNumber?: string;
  displayName?: string;
  graphApiVersion?: string;
  connectedAt?: string;
};

export type WhatsAppEncryptedCredentials = {
  accessToken: string;
  phoneNumberId: string;
  tokenExpiresAt?: string;
};

export type WhatsAppIntegrationSummary = {
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  phoneNumber?: string;
  displayName?: string;
  phoneNumberId?: string;
  wabaId?: string;
  connectedAccountId?: string;
};

export type WhatsAppPublicConfig = {
  /** @deprecated Use embeddedSignupConfigured */
  configured: boolean;
  messagingConfigured: boolean;
  embeddedSignupConfigured: boolean;
  appId?: string;
  configId?: string;
};
