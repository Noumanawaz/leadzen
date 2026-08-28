import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { CreditsModule } from '../credits/credits.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [EntitlementsModule, CreditsModule, AuditModule, PermissionsModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
