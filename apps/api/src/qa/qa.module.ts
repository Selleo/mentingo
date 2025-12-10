import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";
import { QARepository } from "src/qa/repositories/qa.repository";
import { QAService } from "src/qa/services/qa.service";

import { QAController } from "./qa.controller";

@Module({
  imports: [LocalizationModule],
  controllers: [QAController],
  providers: [QAService, QARepository],
})
export class QAModule {}
