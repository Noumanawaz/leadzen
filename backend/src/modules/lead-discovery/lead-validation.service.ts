import { Injectable } from '@nestjs/common';
import type { NormalizedLead } from './lead-source.types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class LeadValidationService {
  normalizePhone(phone?: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/[^\d+]/g, '');
    return digits.length >= 7 ? digits : null;
  }

  normalizeEmail(email?: string | null): string | null {
    if (!email) return null;
    const trimmed = email.trim().toLowerCase();
    return EMAIL_RE.test(trimmed) ? trimmed : null;
  }

  normalizeDomain(website?: string | null): string | null {
    if (!website) return null;
    try {
      const withProto = website.includes('://') ? website : `https://${website}`;
      const host = new URL(withProto).hostname.replace(/^www\./, '').toLowerCase();
      return host || null;
    } catch {
      return website
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .split('/')[0]
        ?.toLowerCase() || null;
    }
  }

  sanitize(lead: NormalizedLead): {
    ok: boolean;
    lead: NormalizedLead;
    errors: string[];
  } {
    const errors: string[] = [];
    const email = this.normalizeEmail(lead.email);
    if (lead.email && !email) errors.push('Invalid email');
    const phone = this.normalizePhone(lead.phone);
    if (lead.phone && !phone) errors.push('Invalid phone');

    const hasIdentity =
      Boolean(email) ||
      Boolean(phone) ||
      Boolean(lead.companyName?.trim()) ||
      Boolean(lead.firstName?.trim() || lead.lastName?.trim());

    if (!hasIdentity) {
      errors.push('Need email, phone, name, or company');
    }

    return {
      ok: errors.length === 0,
      errors,
      lead: {
        ...lead,
        email,
        phone,
        firstName: lead.firstName?.trim() || null,
        lastName: lead.lastName?.trim() || null,
        companyName: lead.companyName?.trim() || null,
        companyDomain:
          this.normalizeDomain(lead.companyDomain) ??
          this.normalizeDomain(lead.website),
        website: lead.website?.trim() || null,
        jobTitle: lead.jobTitle?.trim() || null,
        city: lead.city?.trim() || null,
        state: lead.state?.trim() || null,
        country: lead.country?.trim() || null,
      },
    };
  }
}
