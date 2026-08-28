jest.mock('../../../generated/prisma/client', () => ({
  PlatformAdminStatus: {
    active: 'active',
    disabled: 'disabled',
  },
  PrismaClient: class PrismaClient {},
}));

import { ForbiddenException } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';

describe('PlatformAdminService', () => {
  const prisma = {
    platformAdmin: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const config = {
    get: jest.fn(() => 'admin@example.com, other@example.com'),
  };

  let service: PlatformAdminService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PlatformAdminService(prisma as never, config as never);
  });

  it('parses allowlist emails', () => {
    expect(service.parseAllowlist()).toEqual([
      'admin@example.com',
      'other@example.com',
    ]);
  });

  it('bootstraps platform admin from allowlist', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue(null);
    prisma.platformAdmin.create.mockResolvedValue({
      id: 'pa_1',
      status: 'active',
      userId: 'u1',
    });
    prisma.platformAdmin.update.mockResolvedValue({});

    const admin = await service.resolveForUser({
      userId: 'u1',
      email: 'admin@example.com',
    });

    expect(prisma.platformAdmin.create).toHaveBeenCalled();
    expect(admin?.id).toBe('pa_1');
  });

  it('does not bootstrap non-allowlisted users', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue(null);
    const admin = await service.resolveForUser({
      userId: 'u2',
      email: 'rando@example.com',
    });
    expect(admin).toBeNull();
    expect(prisma.platformAdmin.create).not.toHaveBeenCalled();
  });

  it('requireActive rejects non-admins', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue(null);
    await expect(
      service.requireActive({ userId: 'u2', email: 'rando@example.com' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
