export type WhatsAppConnectionMethod = 'embedded_signup' | 'manual_legacy';

export type WhatsAppAccountMetadata = {
  wabaId?: string;
  businessId?: string;
  phoneNumber?: string;
  displayName?: string;
  graphApiVersion?: string;
  connectedAt?: string;
  connectionMethod?: WhatsAppConnectionMethod;
  lastVerifiedAt?: string;
  tokenExpiresAt?: string;
};

export type WhatsAppEncryptedCredentials = {
  accessToken: string;
  phoneNumberId: string;
  tokenExpiresAt?: string;
};

export type WhatsAppIntegrationSummary = {
  connected: boolean;
  status:
    | 'connected'
    | 'disconnected'
    | 'error'
    | 'pending'
    | 'requires_reconnect';
  phoneNumber?: string;
  displayName?: string;
  phoneNumberId?: string;
  wabaId?: string;
  connectedAccountId?: string;
  lastVerifiedAt?: string;
  connectionMethod?: WhatsAppConnectionMethod;
};

export type WhatsAppPublicConfig = {
  /** @deprecated Use embeddedSignupConfigured */
  configured: boolean;
  messagingConfigured: boolean;
  embeddedSignupConfigured: boolean;
  appId?: string;
  configId?: string;
  missingEnvVars?: string[];
  devManualConnectAvailable?: boolean;
  graphApiVersion?: string;
};

export type WhatsAppPlatformSetupStatus = {
  embeddedSignupConfigured: boolean;
  messagingConfigured: boolean;
  tokenEncryptionConfigured: boolean;
  missingEnvVars: string[];
  webhookPath: string;
  setupSteps: string[];
  appId?: string;
  graphApiVersion: string;
  devManualConnectAvailable: boolean;
};
