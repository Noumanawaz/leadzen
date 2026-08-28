import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../../modules/permissions/permissions.catalog';

export const PERMISSIONS_KEY = 'permissions';

export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
