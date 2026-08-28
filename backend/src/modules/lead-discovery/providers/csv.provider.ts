import { Injectable } from '@nestjs/common';
import type { NormalizedLead } from '../lead-source.types';

export type CsvMapping = Record<string, string>;

const FIELD_ALIASES: Record<string, string[]> = {
  firstName: ['first_name', 'firstname', 'first', 'given_name'],
  lastName: ['last_name', 'lastname', 'last', 'surname', 'family_name'],
  email: ['email', 'e-mail', 'email_address', 'mail'],
  phone: ['phone', 'mobile', 'telephone', 'phone_number', 'cell'],
  jobTitle: ['job_title', 'title', 'position', 'role'],
  website: ['website', 'url', 'web', 'company_website'],
  companyName: ['company', 'company_name', 'organization', 'org', 'business'],
  city: ['city', 'town'],
  state: ['state', 'province', 'region'],
  country: ['country', 'nation'],
};

@Injectable()
export class CsvProvider {
  parseDelimited(text: string): { headers: string[]; rows: string[][] } {
    const lines = this.splitLines(text);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = this.parseLine(lines[0]!);
    const rows = lines.slice(1).map((line) => this.parseLine(line));
    return { headers, rows };
  }

  suggestMapping(headers: string[]): CsvMapping {
    const mapping: CsvMapping = {};
    for (const header of headers) {
      const key = header.trim().toLowerCase().replace(/\s+/g, '_');
      for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.includes(key) || key === field.toLowerCase()) {
          mapping[header] = field;
          break;
        }
      }
    }
    return mapping;
  }

  rowsToLeads(
    headers: string[],
    rows: string[][],
    mapping: CsvMapping,
    sourceId?: string,
  ): NormalizedLead[] {
    return rows
      .filter((row) => row.some((cell) => cell.trim().length > 0))
      .map((row) => {
        const values: Record<string, string> = {};
        headers.forEach((header, i) => {
          const field = mapping[header];
          if (field && row[i] !== undefined) {
            values[field] = row[i]!.trim();
          }
        });
        return {
          firstName: values.firstName || null,
          lastName: values.lastName || null,
          email: values.email || null,
          phone: values.phone || null,
          jobTitle: values.jobTitle || null,
          website: values.website || null,
          companyName: values.companyName || null,
          city: values.city || null,
          state: values.state || null,
          country: values.country || null,
          sourceType: 'csv' as const,
          sourceId: sourceId ?? null,
          sourceName: 'CSV import',
          sourceMetadata: { raw: values },
        };
      });
  }

  private splitLines(text: string): string[] {
    return text
      .replace(/^\uFEFF/, '')
      .split(/\r?\n/)
      .filter((line, i, arr) => !(i === arr.length - 1 && line === ''));
  }

  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current);
    return result;
  }
}
