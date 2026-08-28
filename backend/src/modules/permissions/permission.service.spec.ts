import { PermissionService } from './permission.service';

describe('PermissionService', () => {
  const service = new PermissionService();

  it('gives owner every permission including billing and org delete', () => {
    expect(service.can('owner', 'org:billing')).toBe(true);
    expect(service.can('owner', 'org:delete')).toBe(true);
  });

  it('denies member billing and member admin actions', () => {
    expect(service.can('member', 'org:billing')).toBe(false);
    expect(service.can('member', 'members:invite')).toBe(false);
    expect(service.can('member', 'leads:read')).toBe(true);
  });

  it('allows manager pipeline manage but not billing', () => {
    expect(service.can('manager', 'pipelines:manage')).toBe(true);
    expect(service.can('manager', 'org:billing')).toBe(false);
  });

  it('allows admin member invite but not org delete', () => {
    expect(service.can('admin', 'members:invite')).toBe(true);
    expect(service.can('admin', 'org:delete')).toBe(false);
  });
});
