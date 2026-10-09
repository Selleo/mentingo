import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { EmailTemplateRenderingModule } from "src/email-templates/email-template-rendering.module";
import { EmailTemplateModule } from "src/email-templates/email-template.module";
import { LocalizationModule } from "src/localization/localization.module";

import { AutomationDefinitionStorageModule } from "./automation-definition-storage.module";
import { AutomationManagementController } from "./automation-management.controller";
import { AutomationRunHistoryController } from "./automation-run-history.controller";
import { AutomationRecipientOptionsRepository } from "./repositories/automation-recipient-options.repository";
import { AutomationRunHistoryRepository } from "./repositories/automation-run-history.repository";
import { AutomationManagementService } from "./services/automation-management.service";
import { AutomationRunHistoryService } from "./services/automation-run-history.service";
import { AutomationValidationAndSimulationService } from "./services/automation-validation-and-simulation.service";

@Module({
  imports: [
    EmailModule,
    EmailTemplateModule,
    EmailTemplateRenderingModule,
    AutomationDefinitionStorageModule,
    LocalizationModule,
  ],
  controllers: [AutomationManagementController, AutomationRunHistoryController],
  providers: [
    AutomationRecipientOptionsRepository,
    AutomationManagementService,
    AutomationValidationAndSimulationService,
    AutomationRunHistoryRepository,
    AutomationRunHistoryService,
  ],
  exports: [AutomationValidationAndSimulationService],
})
export class AutomationModule {}
