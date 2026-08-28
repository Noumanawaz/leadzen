import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../modules/auth/auth.module';
import { PermissionsModule } from '../modules/permissions/permissions.module';
import { AuthGuard } from './guards/auth.guard';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { PlatformAdminGuard } from './guards/platform-admin.guard';

@Global()
@Module({
  imports: [AuthModule, PermissionsModule],
  providers: [
    AuthGuard,
    OrgMembershipGuard,
    PermissionsGuard,
    PlatformAdminGuard,
  ],
  exports: [
    AuthModule,
    AuthGuard,
    OrgMembershipGuard,
    PermissionsGuard,
    PlatformAdminGuard,
  ],
})
export class CommonAuthModule {}
