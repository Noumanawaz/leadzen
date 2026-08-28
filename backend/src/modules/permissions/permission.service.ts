import { Injectable } from '@nestjs/common';
import {
  MembershipRoleName,
  Permission,
  ROLE_PERMISSIONS,
} from './permissions.catalog';

@Injectable()
export class PermissionService {
  permissionsFor(role: MembershipRoleName): Permission[] {
    return ROLE_PERMISSIONS[role] ?? [];
  }

  can(role: MembershipRoleName, permission: Permission): boolean {
    return this.permissionsFor(role).includes(permission);
  }

  assertCan(role: MembershipRoleName, permission: Permission): void {
    if (!this.can(role, permission)) {
      throw new Error(`Missing permission: ${permission}`);
    }
  }
}
