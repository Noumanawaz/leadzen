import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DuplicatePolicy,
  LeadImportStatus,
  Prisma,
} from '../../../generated/prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { FIND_LEADS_COST_CODES } from './credit-cost.constants';
import { LeadDiscoveryService } from './lead-discovery.service';
import type { DuplicatePolicyName } from './lead-source.types';
import { CsvProvider, type CsvMapping } from './providers/csv.provider';

@Injectable()
export class LeadImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly csv: CsvProvider,
    private readonly discovery: LeadDiscoveryService,
  ) {}

  list(organizationId: string) {
    return this.prisma.leadImport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async get(organizationId: string, id: string) {
    const row = await this.prisma.leadImport.findFirst({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('Import not found');
    return row;
  }

  async createFromUpload(params: {
    organizationId: string;
    userId: string;
    filename: string;
    buffer: Buffer;
  }) {
    const text = await this.bufferToText(params.filename, params.buffer);
    const { headers, rows } = this.csv.parseDelimited(text);
    if (!headers.length) {
      throw new BadRequestException('File has no header row');
    }
    const suggested = this.csv.suggestMapping(headers);

    return this.prisma.leadImport.create({
      data: {
        organizationId: params.organizationId,
        filename: params.filename,
        status: LeadImportStatus.mapping,
        headers,
        mapping: suggested,
        totalRows: rows.length,
        validRows: 0,
        createdByUserId: params.userId,
        rawPreview: {
          preview: rows.slice(0, 20),
          rows,
        },
      },
    });
  }

  async updateMapping(
    organizationId: string,
    id: string,
    mapping: CsvMapping,
    duplicatePolicy?: DuplicatePolicyName,
  ) {
    const job = await this.get(organizationId, id);
    const headers = (job.headers as string[]) ?? [];
    const payload = job.rawPreview as {
      rows?: string[][];
      preview?: string[][];
    } | null;
    const rows = payload?.rows ?? [];
    const leads = this.csv.rowsToLeads(headers, rows, mapping, id);
    const preview = await this.discovery.preview(
      organizationId,
      leads.slice(0, 50),
    );

    return this.prisma.leadImport.update({
      where: { id },
      data: {
        mapping,
        duplicatePolicy: (duplicatePolicy ??
          job.duplicatePolicy) as DuplicatePolicy,
        validRows: leads.filter((l) => l.email || l.phone || l.companyName)
          .length,
        rawPreview: {
          ...payload,
          validationPreview: preview,
        } as Prisma.InputJsonValue,
      },
    });
  }

  async markQueued(organizationId: string, id: string) {
    const job = await this.get(organizationId, id);
    if (!job.mapping) {
      throw new BadRequestException('Set column mapping before starting');
    }
    return this.prisma.leadImport.update({
      where: { id },
      data: {
        status: LeadImportStatus.queued,
        startedAt: new Date(),
      },
    });
  }

  async processJob(importId: string) {
    const job = await this.prisma.leadImport.findUnique({
      where: { id: importId },
    });
    if (!job) return;

    await this.prisma.leadImport.update({
      where: { id: importId },
      data: { status: LeadImportStatus.processing },
    });

    try {
      const headers = (job.headers as string[]) ?? [];
      const mapping = (job.mapping ?? {}) as CsvMapping;
      const payload = job.rawPreview as {
        rows?: string[][];
        preview?: string[][];
      } | null;
      const rows = payload?.rows ?? [];
      const leads = this.csv.rowsToLeads(headers, rows, mapping, job.id);

      const result = await this.discovery.commit({
        organizationId: job.organizationId,
        actorUserId: job.createdByUserId ?? undefined,
        leads,
        duplicatePolicy: job.duplicatePolicy as DuplicatePolicyName,
        creditCostCode: FIND_LEADS_COST_CODES.CSV_IMPORT,
      });

      await this.prisma.leadImport.update({
        where: { id: importId },
        data: {
          status: LeadImportStatus.completed,
          importedRows: result.created + result.updated,
          skippedRows: result.skipped,
          failedRows: result.failed,
          errorReport: result.errors,
          completedAt: new Date(),
          rawPreview: {
            preview: payload?.preview ?? [],
          },
        },
      });
    } catch (error) {
      await this.prisma.leadImport.update({
        where: { id: importId },
        data: {
          status: LeadImportStatus.failed,
          errorReport: {
            message:
              error instanceof Error ? error.message : 'Import processing failed',
          },
          completedAt: new Date(),
        },
      });
    }
  }

  async errorsCsv(organizationId: string, id: string): Promise<string> {
    const job = await this.get(organizationId, id);
    const errors =
      (job.errorReport as Array<{ index: number; message: string }>) ?? [];
    const lines = ['row_index,message'];
    for (const err of errors) {
      if (typeof err === 'object' && err && 'index' in err) {
        lines.push(
          `${err.index},"${String(err.message).replace(/"/g, '""')}"`,
        );
      }
    }
    return lines.join('\n');
  }

  private async bufferToText(filename: string, buffer: Buffer): Promise<string> {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const XLSX = require('xlsx') as typeof import('xlsx');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]!];
        if (!sheet) throw new BadRequestException('Spreadsheet is empty');
        return XLSX.utils.sheet_to_csv(sheet);
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        throw new BadRequestException(
          'XLSX support requires the xlsx package. Upload CSV instead.',
        );
      }
    }
    return buffer.toString('utf8');
  }
}
