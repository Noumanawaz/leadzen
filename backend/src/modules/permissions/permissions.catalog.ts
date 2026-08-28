/**
 * Workspace membership permissions.
 * Platform admin is separate and never derived from these roles.
 */
export const MEMBERSHIP_ROLES = [
  'owner',
  'admin',
  'manager',
  'member',
] as const;

export type MembershipRoleName = (typeof MEMBERSHIP_ROLES)[number];

export const PERMISSIONS = [
  'org:read',
  'org:update',
  'org:delete',
  'org:billing',
  'members:invite',
  'members:update_role',
  'members:remove',
  'leads:read',
  'leads:create',
  'leads:update',
  'leads:delete',
  'leads:export',
  'leads:import',
  'leads:assign',
  'lead_sources:manage',
  'companies:read',
  'companies:create',
  'companies:update',
  'companies:delete',
  'contacts:read',
  'contacts:create',
  'contacts:update',
  'contacts:delete',
  'pipelines:manage',
  'deals:manage',
  'sequences:manage',
  'campaigns:manage',
  'integrations:connect',
  'api_keys:manage',
  'ai:use',
  'outreach:send',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: Permission[] = [...PERMISSIONS];

const MEMBER_PERMS: Permission[] = [
  'org:read',
  'leads:read',
  'leads:create',
  'leads:update',
  'companies:read',
  'companies:create',
  'companies:update',
  'contacts:read',
  'contacts:create',
  'contacts:update',
  'ai:use',
  'outreach:send',
];

const MANAGER_PERMS: Permission[] = [
  ...MEMBER_PERMS,
  'leads:assign',
  'leads:export',
  'leads:import',
  'leads:delete',
  'companies:delete',
  'contacts:delete',
  'pipelines:manage',
  'deals:manage',
  'sequences:manage',
  'campaigns:manage',
  'lead_sources:manage',
];

const ADMIN_PERMS: Permission[] = [
  ...MANAGER_PERMS,
  'org:update',
  'members:invite',
  'members:update_role',
  'members:remove',
  'integrations:connect',
  'api_keys:manage',
];

export const ROLE_PERMISSIONS: Record<MembershipRoleName, Permission[]> = {
  owner: ALL,
  admin: ADMIN_PERMS,
  manager: MANAGER_PERMS,
  member: MEMBER_PERMS,
};
