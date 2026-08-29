import { Module } from '@nestjs/common';
import { LoadPlatformAdminGuard } from '../../common/guards/load-platform-admin.guard';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CreditsModule } from '../credits/credits.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PlatformAdminService } from './platform-admin.service';

@Module({
  imports: [CreditsModule, AuditModule, AuthModule, WhatsAppModule],
  controllers: [AdminController],
  providers: [AdminService, PlatformAdminService, LoadPlatformAdminGuard],
  exports: [PlatformAdminService, LoadPlatformAdminGuard, AdminService],
})
export class AdminModule {}
