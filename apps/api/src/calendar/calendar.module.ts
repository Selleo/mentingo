import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

import { CalendarController } from "./calendar.controller";
import { CalendarRepository } from "./calendar.repository";
import { CalendarService } from "./calendar.service";

@Module({
  imports: [LocalizationModule, SettingsModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarRepository],
  exports: [CalendarService, CalendarRepository],
})
export class CalendarModule {}
