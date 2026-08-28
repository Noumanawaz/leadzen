import { Injectable } from '@nestjs/common';
import { LeadValidationService } from './lead-validation.service';
import { LeadScoringService } from './lead-scoring.service';
import type { NormalizedLead } from './lead-source.types';
import { CsvProvider } from './providers/csv.provider';

describe('LeadValidationService', () => {
  const service = new LeadValidationService();

  it('normalizes email and phone', () => {
    const result = service.sanitize({
      email: '  Foo@Bar.COM ',
      phone: '+1 (555) 123-4567',
      sourceType: 'csv',
    });
    expect(result.ok).toBe(true);
    expect(result.lead.email).toBe('foo@bar.com');
    expect(result.lead.phone).toContain('555');
  });

  it('rejects empty identity', () => {
    const result = service.sanitize({ sourceType: 'manual' });
    expect(result.ok).toBe(false);
  });
});

describe('LeadScoringService', () => {
  const service = new LeadScoringService();

  it('scores richer leads higher', () => {
    const low: NormalizedLead = { sourceType: 'manual', email: 'a@b.com' };
    const high: NormalizedLead = {
      sourceType: 'apollo',
      email: 'a@b.com',
      phone: '+15551212',
      companyName: 'Acme',
      jobTitle: 'CEO',
      website: 'https://acme.com',
      city: 'NYC',
    };
    expect(service.score(high)).toBeGreaterThan(service.score(low));
  });
});

describe('CsvProvider', () => {
  const csv = new CsvProvider();

  it('parses and maps columns', () => {
    const text = 'Email,First Name,Company\na@b.com,Ada,Acme\n';
    const { headers, rows } = csv.parseDelimited(text);
    const mapping = csv.suggestMapping(headers);
    expect(mapping['Email']).toBe('email');
    const leads = csv.rowsToLeads(headers, rows, mapping);
    expect(leads[0]?.email).toBe('a@b.com');
    expect(leads[0]?.firstName).toBe('Ada');
    expect(leads[0]?.companyName).toBe('Acme');
  });
});
