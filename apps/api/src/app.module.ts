import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthGuard } from './common/auth';
import { CronController, Jobs } from './jobs';
import { AiController } from './modules/ai/ai.controller';
import { AiService } from './modules/ai/ai.service';
import { AnalyticsController } from './modules/analytics/analytics.controller';
import { AuthController } from './modules/auth/auth.controller';
import { BrandController } from './modules/brand/brand.controller';
import { CardsController } from './modules/cards/cards.controller';
import { ConsoleController } from './modules/console/console.controller';
import { CoreController } from './modules/core/core.controller';
import { IntegrationsController } from './modules/integrations/integrations.controller';
import { ScimController } from './modules/integrations/scim.controller';
import { LeadsController } from './modules/leads/leads.controller';
import { MeController } from './modules/me/me.controller';
import { NfcController } from './modules/nfc/nfc.controller';
import { SetupController, SignupController } from './modules/onboarding/onboarding.controller';
import { PeopleController } from './modules/people/people.controller';
import { AnnouncementsController, ConsoleAnnouncementsController } from './modules/platform/announcements.controller';
import { ConsoleHealthController } from './modules/platform/health.controller';
import { ConsoleOperationsController } from './modules/platform/operations.controller';
import { ConsoleReleasesController } from './modules/platform/releases.controller';
import { ConsoleRevenueController } from './modules/platform/revenue.controller';
import { ConsoleSecurityController } from './modules/platform/security.controller';
import { ConsoleUsersController } from './modules/platform/users.controller';
import { PublicController } from './modules/public/public.controller';
import { TeamController } from './modules/public/team.controller';
import { SettingsController } from './modules/settings/settings.controller';

@Module({
  controllers: [
    AuthController,
    CronController,
    CoreController,
    CardsController,
    PeopleController,
    BrandController,
    LeadsController,
    AnalyticsController,
    NfcController,
    IntegrationsController,
    ScimController,
    SettingsController,
    PublicController,
    MeController,
    AiController,
    ConsoleController,
    ConsoleUsersController,
    ConsoleRevenueController,
    ConsoleOperationsController,
    ConsoleAnnouncementsController,
    ConsoleSecurityController,
    ConsoleReleasesController,
    ConsoleHealthController,
    AnnouncementsController,
    SignupController,
    SetupController,
    TeamController,
  ],
  providers: [AiService, Jobs, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
