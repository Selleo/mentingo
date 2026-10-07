import { Global, Module } from "@nestjs/common";

import { NOTIFICATION_ACCOUNT_ACTION_PREPARATION } from "src/automation-execution/automation-execution.constants";
import { AutomationDefinitionStorageModule } from "src/automations/automation-definition-storage.module";
import { AUTOMATION_RUNTIME } from "src/automations/automation.constants";
import { EmailModule } from "src/common/emails/emails.module";
import { EmailTemplateRenderingModule } from "src/email-templates/email-template-rendering.module";
import { EMAIL_TEMPLATE_DEPENDENCIES } from "src/email-templates/email-template.types";

import { AutomationEmailDeliveryRepository } from "./repositories/automation-email-delivery.repository";
import { AutomationRecipientRepository } from "./repositories/automation-recipient.repository";
import { AutomationRecoveryAndCleanupRepository } from "./repositories/automation-recovery-and-cleanup.repository";
import { AutomationRunCreationRepository } from "./repositories/automation-run-creation.repository";
import { AutomationRunStatusRepository } from "./repositories/automation-run-status.repository";
import { DefaultAutomationSetupRepository } from "./repositories/default-automation-setup.repository";
import { NotificationAccountActionRepository } from "./repositories/notification-account-action.repository";
import { AutomationEmailDeliveryStateService } from "./services/automation-email-delivery-state.service";
import { AutomationEmailDeliveryService } from "./services/automation-email-delivery.service";
import { AutomationRecipientResolverService } from "./services/automation-recipient-resolver.service";
import { AutomationRecoveryAndCleanupService } from "./services/automation-recovery-and-cleanup.service";
import { AutomationRunCreationService } from "./services/automation-run-creation.service";
import { AutomationRunStatusService } from "./services/automation-run-status.service";
import { DefaultAutomationSetupService } from "./services/default-automation-setup.service";
import { EmailTemplateAutomationUsageService } from "./services/email-template-automation-usage.service";
import { NotificationAccountActionService } from "./services/notification-account-action.service";
import { AutomationEmailWorker } from "./workers/automation-email.worker";

@Global()
@Module({
  imports: [AutomationDefinitionStorageModule, EmailModule, EmailTemplateRenderingModule],
  providers: [
    AutomationEmailDeliveryRepository,
    AutomationRunCreationRepository,
    AutomationRecipientRepository,
    AutomationRecipientResolverService,
    AutomationRecoveryAndCleanupRepository,
    DefaultAutomationSetupRepository,
    AutomationRunStatusRepository,
    NotificationAccountActionRepository,
    AutomationEmailDeliveryStateService,
    AutomationEmailDeliveryService,
    AutomationRunCreationService,
    AutomationRecoveryAndCleanupService,
    DefaultAutomationSetupService,
    AutomationRunStatusService,
    NotificationAccountActionService,
    EmailTemplateAutomationUsageService,
    AutomationEmailWorker,
    { provide: AUTOMATION_RUNTIME, useExisting: AutomationRunStatusService },
    {
      provide: NOTIFICATION_ACCOUNT_ACTION_PREPARATION,
      useExisting: NotificationAccountActionService,
    },
    { provide: EMAIL_TEMPLATE_DEPENDENCIES, useExisting: EmailTemplateAutomationUsageService },
  ],
  exports: [
    AUTOMATION_RUNTIME,
    EMAIL_TEMPLATE_DEPENDENCIES,
    NotificationAccountActionService,
    DefaultAutomationSetupService,
  ],
})
export class AutomationExecutionModule {}
