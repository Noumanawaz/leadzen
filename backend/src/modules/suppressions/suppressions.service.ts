import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SuppressionsService {
  constructor(private readonly prisma: PrismaService) {}

  async isEmailSuppressed(
    organizationId: string,
    email: string,
  ): Promise<boolean> {
    const normalized = email.trim().toLowerCase();
    const hit = await this.prisma.suppression.findFirst({
      where: {
        organizationId,
        email: { equals: normalized, mode: 'insensitive' },
      },
    });
    return Boolean(hit);
  }

  async isPhoneSuppressed(
    organizationId: string,
    phone: string,
  ): Promise<boolean> {
    const hit = await this.prisma.suppression.findFirst({
      where: { organizationId, phone },
    });
    return Boolean(hit);
  }

  addEmail(
    organizationId: string,
    email: string,
    reason: string,
    source?: string,
  ) {
    return this.prisma.suppression.create({
      data: {
        organizationId,
        email: email.trim().toLowerCase(),
        reason,
        source,
      },
    });
  }

  addPhone(
    organizationId: string,
    phone: string,
    reason: string,
    source?: string,
  ) {
    return this.prisma.suppression.create({
      data: {
        organizationId,
        phone: phone.trim(),
        reason,
        source,
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const row = await this.prisma.suppression.findFirst({
      where: { id, organizationId },
    });
    if (!row) return null;
    return this.prisma.suppression.delete({ where: { id } });
  }

  list(organizationId: string) {
    return this.prisma.suppression.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
