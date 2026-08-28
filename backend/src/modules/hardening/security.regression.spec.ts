import { ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PermissionService } from '../permissions/permission.service';

describe('Phase 8 security regressions', () => {
  const adminGuard = new PlatformAdminGuard();
  const permissions = new PermissionService();

  it('tenant owner is not platform admin', () => {
    expect(() =>
      adminGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => ({}) }),
      } as never),
    ).toThrow(ForbiddenException);
  });

  it('member cannot access billing or org delete', () => {
    expect(permissions.can('member', 'org:billing')).toBe(false);
    expect(permissions.can('member', 'org:delete')).toBe(false);
  });

  it('manager cannot delete org', () => {
    expect(permissions.can('manager', 'org:delete')).toBe(false);
  });

  it('owner can billing but still needs platform_admins for /api/admin', () => {
    expect(permissions.can('owner', 'org:billing')).toBe(true);
    expect(() =>
      adminGuard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            // even with a user present, missing platformAdmin fails
            user: { id: 'owner_1', email: 'owner@test.com' },
          }),
        }),
      } as never),
    ).toThrow(ForbiddenException);
  });
});
