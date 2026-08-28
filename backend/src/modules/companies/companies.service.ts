import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateCompanyDto,
  CreateContactDto,
  LinkCompanyContactDto,
  UpdateCompanyDto,
} from './dto/companies.dto';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.company.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { leads: true, companyContacts: true } },
      },
    });
  }

  async get(organizationId: string, id: string) {
    const company = await this.prisma.company.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        companyContacts: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                jobTitle: true,
              },
            },
          },
        },
        leads: {
          where: { deletedAt: null },
          take: 20,
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  create(organizationId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: { organizationId, ...dto },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateCompanyDto) {
    await this.get(organizationId, id);
    return this.prisma.company.update({ where: { id }, data: dto });
  }

  async remove(organizationId: string, id: string) {
    await this.get(organizationId, id);
    return this.prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async linkContact(
    organizationId: string,
    companyId: string,
    dto: LinkCompanyContactDto,
  ) {
    await this.get(organizationId, companyId);
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, organizationId, deletedAt: null },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    return this.prisma.companyContact.upsert({
      where: {
        companyId_contactId: { companyId, contactId: dto.contactId },
      },
      create: {
        organizationId,
        companyId,
        contactId: dto.contactId,
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
        title: dto.title,
      },
      update: {
        role: dto.role,
        isPrimary: dto.isPrimary ?? false,
        title: dto.title,
      },
    });
  }

  listContacts(organizationId: string) {
    return this.prisma.contact.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createContact(organizationId: string, dto: CreateContactDto) {
    return this.prisma.contact.create({
      data: { organizationId, ...dto },
    });
  }
}
