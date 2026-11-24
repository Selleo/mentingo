import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { CalendarController } from "./calendar.controller";
import { GoogleCalendarApiClient } from "./clients/google-calendar-api.client";
import { MicrosoftGraphApiClient } from "./clients/microsoft-graph-api.client";
import { GoogleCalendarOAuthController } from "./google-calendar-oauth.controller";
import { GoogleCalendarController } from "./google-calendar.controller";
import { CourseDueDateCalendarHandler } from "./handlers/course-due-date-calendar.handler";
import { GoogleCalendarOutboundHandler } from "./handlers/google-calendar-outbound.handler";
import { GoogleCalendarUserLifecycleHandler } from "./handlers/google-calendar-user-lifecycle.handler";
import { MicrosoftCalendarOutboundHandler } from "./handlers/microsoft-calendar-outbound.handler";
import { MicrosoftCalendarUserLifecycleHandler } from "./handlers/microsoft-calendar-user-lifecycle.handler";
import { MicrosoftCalendarOAuthController } from "./microsoft-calendar-oauth.controller";
import { MicrosoftCalendarController } from "./microsoft-calendar.controller";
import { CalendarConnectionRepository } from "./repositories/calendar-connection.repository";
import { CalendarRepository } from "./repositories/calendar.repository";
import { CalendarTokenEncryptionService } from "./services/calendar-token-encryption.service";
import { CalendarService } from "./services/calendar.service";
import { CourseDueDateCalendarService } from "./services/course-due-date-calendar.service";
import { GoogleCalendarAccessTokenService } from "./services/google-calendar-access-token.service";
import { GoogleCalendarOutboundService } from "./services/google-calendar-outbound.service";
import { GoogleCalendarSyncQueueService } from "./services/google-calendar-sync-queue.service";
import { GoogleCalendarService } from "./services/google-calendar.service";
import { MicrosoftCalendarOutboundService } from "./services/microsoft-calendar-outbound.service";
import { MicrosoftCalendarSyncQueueService } from "./services/microsoft-calendar-sync-queue.service";
import { MicrosoftCalendarService } from "./services/microsoft-calendar.service";
import { GoogleCalendarSyncWorker } from "./workers/google-calendar-sync.worker";
import { GoogleCalendarCron } from "./workers/google-calendar.cron";
import { MicrosoftCalendarSyncWorker } from "./workers/microsoft-calendar-sync.worker";
import { MicrosoftCalendarCron } from "./workers/microsoft-calendar.cron";

@Module({
  imports: [LocalizationModule, SettingsModule],
  controllers: [
    CalendarController,
    MicrosoftCalendarController,
    MicrosoftCalendarOAuthController,
    GoogleCalendarController,
    GoogleCalendarOAuthController,
  ],
  providers: [
    CalendarService,
    CalendarRepository,
    CourseDueDateCalendarService,
    CourseDueDateCalendarHandler,
    CalendarConnectionRepository,
    CalendarTokenEncryptionService,
    MicrosoftGraphApiClient,
    MicrosoftCalendarSyncQueueService,
    MicrosoftCalendarService,
    MicrosoftCalendarOutboundService,
    MicrosoftCalendarSyncWorker,
    MicrosoftCalendarCron,
    MicrosoftCalendarUserLifecycleHandler,
    MicrosoftCalendarOutboundHandler,
    GoogleCalendarApiClient,
    GoogleCalendarAccessTokenService,
    GoogleCalendarSyncQueueService,
    GoogleCalendarService,
    GoogleCalendarOutboundService,
    GoogleCalendarSyncWorker,
    GoogleCalendarCron,
    GoogleCalendarUserLifecycleHandler,
    GoogleCalendarOutboundHandler,
  ],
  exports: [
    CalendarService,
    CalendarRepository,
    CourseDueDateCalendarService,
    MicrosoftCalendarService,
    GoogleCalendarService,
  ],
})
export class CalendarModule {}
