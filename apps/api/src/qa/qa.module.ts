import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { QARepository } from "src/qa/repositories/qa.repository";
import { QAService } from "src/qa/services/qa.service";
import { SettingsModule } from "src/settings/settings.module";

import { QAController } from "./qa.controller";

@Module({
  imports: [LocalizationModule, SettingsModule],
  controllers: [QAController],
  providers: [QAService, QARepository],
})
export class QAModule {}
