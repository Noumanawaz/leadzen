import { randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import type {
  PlaceCallInput,
  PlaceCallResult,
  PhoneProvider,
  SendSmsInput,
  SendSmsResult,
  SmsProvider,
} from '../outreach/providers.types';

@Injectable()
export class PlaceholderSmsProvider implements SmsProvider {
  async send(input: SendSmsInput): Promise<SendSmsResult> {
    if (!input.toE164?.startsWith('+') || input.toE164.length < 8) {
      return {
        providerMessageId: `sms_fail_${randomBytes(4).toString('hex')}`,
        status: 'failed',
      };
    }
    return {
      providerMessageId: `sms_${randomBytes(6).toString('hex')}`,
      status: 'sent',
    };
  }
}

@Injectable()
export class PlaceholderPhoneProvider implements PhoneProvider {
  async placeCall(input: PlaceCallInput): Promise<PlaceCallResult> {
    if (!input.toE164?.startsWith('+')) {
      return {
        providerCallId: `call_fail_${randomBytes(4).toString('hex')}`,
        status: 'failed',
        simulatedMinutes: 0,
      };
    }
    const outcomes: PlaceCallResult['status'][] = [
      'completed',
      'no_answer',
      'busy',
      'completed',
    ];
    const status = outcomes[Math.floor(Math.random() * outcomes.length)];
    return {
      providerCallId: `call_${randomBytes(6).toString('hex')}`,
      status,
      simulatedMinutes: status === 'completed' ? 1 + Math.floor(Math.random() * 4) : 0,
    };
  }
}
