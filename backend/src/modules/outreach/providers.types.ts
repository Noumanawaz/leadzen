export type SendEmailInput = {
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

export type SendEmailResult = {
  providerMessageId: string;
  threadId?: string;
};

export interface EmailProvider {
  send(input: SendEmailInput): Promise<SendEmailResult>;
}

export type SendWhatsAppInput = {
  toE164: string;
  body: string;
};

export type SendWhatsAppTextInput = SendWhatsAppInput;

export type SendWhatsAppTemplateInput = {
  toE164: string;
  templateName: string;
  language: string;
  components?: unknown[];
};

export type SendWhatsAppMediaInput = {
  toE164: string;
  mediaType: 'image' | 'document' | 'audio' | 'video';
  link: string;
  caption?: string;
};

export type SendWhatsAppResult = {
  providerMessageId: string;
  status: 'queued' | 'sent' | 'failed';
  error?: string;
  authError?: boolean;
};

export interface WhatsAppProvider {
  sendTextMessage(
    input: SendWhatsAppTextInput,
    credentials: { accessToken: string; phoneNumberId: string },
  ): Promise<SendWhatsAppResult>;
  sendTemplateMessage(
    input: SendWhatsAppTemplateInput,
    credentials: { accessToken: string; phoneNumberId: string },
  ): Promise<SendWhatsAppResult>;
  sendMediaMessage(
    input: SendWhatsAppMediaInput,
    credentials: { accessToken: string; phoneNumberId: string },
  ): Promise<SendWhatsAppResult>;
}

export type SendSmsInput = {
  toE164: string;
  body: string;
};

export type SendSmsResult = {
  providerMessageId: string;
  status: 'queued' | 'sent' | 'failed';
};

export interface SmsProvider {
  send(input: SendSmsInput): Promise<SendSmsResult>;
}

export type PlaceCallInput = {
  toE164: string;
};

export type PlaceCallResult = {
  providerCallId: string;
  status:
    | 'queued'
    | 'ringing'
    | 'in_progress'
    | 'completed'
    | 'failed'
    | 'no_answer'
    | 'busy';
  simulatedMinutes: number;
};

export interface PhoneProvider {
  placeCall(input: PlaceCallInput): Promise<PlaceCallResult>;
}
