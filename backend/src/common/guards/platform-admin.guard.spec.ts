import { ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  function ctx(platformAdmin?: { id: string; status: string }) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ platformAdmin }),
      }),
    } as never;
  }

  it('allows active platform admin', () => {
    expect(
      guard.canActivate(ctx({ id: 'pa_1', status: 'active' })),
    ).toBe(true);
  });

  it('rejects missing platform admin (tenant owner is not enough)', () => {
    expect(() => guard.canActivate(ctx())).toThrow(ForbiddenException);
  });

  it('rejects disabled platform admin', () => {
    expect(() =>
      guard.canActivate(ctx({ id: 'pa_1', status: 'disabled' })),
    ).toThrow(ForbiddenException);
  });
});
