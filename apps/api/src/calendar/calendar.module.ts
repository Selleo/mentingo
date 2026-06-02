import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { CalendarController } from "./calendar.controller";
import { CalendarRepository } from "./calendar.repository";
import { CalendarService } from "./calendar.service";
import { CourseDueDateCalendarService } from "./course-due-date-calendar.service";
import { CourseDueDateCalendarHandler } from "./handlers/course-due-date-calendar.handler";

@Module({
  imports: [CqrsModule, LocalizationModule, SettingsModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarRepository,
    CourseDueDateCalendarService,
    CourseDueDateCalendarHandler,
  ],
  exports: [CalendarService, CalendarRepository, CourseDueDateCalendarService],
})
export class CalendarModule {}
