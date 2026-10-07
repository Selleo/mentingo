import { Module } from "@nestjs/common";

import { LocalizationModule } from "src/localization/localization.module";

import { AutomationDefinitionRepository } from "./repositories/automation-definition.repository";
import { AutomationDefinitionStorageService } from "./services/automation-definition-storage.service";

@Module({
  imports: [LocalizationModule],
  providers: [AutomationDefinitionRepository, AutomationDefinitionStorageService],
  exports: [AutomationDefinitionStorageService],
})
export class AutomationDefinitionStorageModule {}
