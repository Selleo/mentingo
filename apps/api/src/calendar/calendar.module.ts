import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { CalendarController } from "./calendar.controller";
import { MicrosoftGraphApiClient } from "./clients/microsoft-graph-api.client";
import { CourseDueDateCalendarHandler } from "./handlers/course-due-date-calendar.handler";
import { MicrosoftCalendarOutboundHandler } from "./handlers/microsoft-calendar-outbound.handler";
import { MicrosoftCalendarUserLifecycleHandler } from "./handlers/microsoft-calendar-user-lifecycle.handler";
import { MicrosoftCalendarOAuthController } from "./microsoft-calendar-oauth.controller";
import { MicrosoftCalendarController } from "./microsoft-calendar.controller";
import { CalendarRepository } from "./repositories/calendar.repository";
import { MicrosoftCalendarRepository } from "./repositories/microsoft-calendar.repository";
import { CalendarService } from "./services/calendar.service";
import { CourseDueDateCalendarService } from "./services/course-due-date-calendar.service";
import { MicrosoftCalendarOutboundService } from "./services/microsoft-calendar-outbound.service";
import { MicrosoftCalendarSyncQueueService } from "./services/microsoft-calendar-sync-queue.service";
import { MicrosoftCalendarTokenEncryptionService } from "./services/microsoft-calendar-token-encryption.service";
import { MicrosoftCalendarService } from "./services/microsoft-calendar.service";
import { MicrosoftCalendarSyncWorker } from "./workers/microsoft-calendar-sync.worker";
import { MicrosoftCalendarCron } from "./workers/microsoft-calendar.cron";

@Module({
  imports: [CqrsModule, LocalizationModule, SettingsModule],
  controllers: [CalendarController, MicrosoftCalendarController, MicrosoftCalendarOAuthController],
  providers: [
    CalendarService,
    CalendarRepository,
    CourseDueDateCalendarService,
    CourseDueDateCalendarHandler,
    MicrosoftCalendarRepository,
    MicrosoftGraphApiClient,
    MicrosoftCalendarTokenEncryptionService,
    MicrosoftCalendarSyncQueueService,
    MicrosoftCalendarService,
    MicrosoftCalendarOutboundService,
    MicrosoftCalendarSyncWorker,
    MicrosoftCalendarCron,
    MicrosoftCalendarUserLifecycleHandler,
    MicrosoftCalendarOutboundHandler,
  ],
  exports: [
    CalendarService,
    CalendarRepository,
    CourseDueDateCalendarService,
    MicrosoftCalendarService,
  ],
})
export class CalendarModule {}
