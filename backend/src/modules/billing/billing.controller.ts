import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { IsString } from 'class-validator';
import {
  CurrentUser,
  OrgId,
} from '../../common/decorators/auth.decorators';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { OrgMembershipGuard } from '../../common/guards/org-membership.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import type { AuthUserPayload } from '../../common/types/request-context';
import { BillingService } from './billing.service';
import { StripeService } from './stripe.service';

class CheckoutDto {
  @IsString()
  planCode!: string;
}

@ApiTags('billing')
@Controller('v1/billing')
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
  ) {}

  @Get('plans')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  listPlans() {
    return this.billing.listPlans();
  }

  @Get('config')
  config() {
    return {
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? '',
      configured: this.stripe.isConfigured(),
    };
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:billing')
  @Get('subscription')
  subscription(@OrgId() organizationId: string) {
    return this.billing.getSubscription(organizationId);
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:billing')
  @Post('checkout')
  checkout(
    @OrgId() organizationId: string,
    @CurrentUser() user: AuthUserPayload,
    @Body() dto: CheckoutDto,
  ) {
    return this.billing.createCheckoutSession({
      organizationId,
      userId: user.id,
      email: user.email,
      planCode: dto.planCode,
    });
  }

  @ApiBearerAuth()
  @ApiHeader({ name: 'x-organization-id', required: true })
  @UseGuards(AuthGuard, OrgMembershipGuard, PermissionsGuard)
  @RequirePermissions('org:billing')
  @Post('portal')
  portal(@OrgId() organizationId: string) {
    return this.billing.createPortalSession(organizationId);
  }

  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Post('sync-catalog')
  async syncCatalog(@CurrentUser() user: AuthUserPayload) {
    // Owner-level platform bootstrap for test mode; restrict further in Phase 7
    await this.stripe.syncCatalog();
    return { ok: true, actor: user.email };
  }

  @Post('webhooks/stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!req.rawBody) {
      throw new Error('Raw body missing for Stripe webhook');
    }
    return this.billing.handleWebhook(req.rawBody, signature);
  }
}
