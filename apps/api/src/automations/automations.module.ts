import { Module } from "@nestjs/common";

import { AutomationRunnerService } from "./automation-runner/automation-runner.service";
import { AutomationStepsController } from "./automations-steps/automations-steps.controller";
import { AutomationStepsService } from "./automations-steps/automations-steps.service";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationsHandler } from "./handlers/automations-handler";
import { AutomationStepsRepository } from "./repositories/automation-steps/automation-steps.repository";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [
    AutomationsRepository,
    AutomationsService,
    AutomationStepsService,
    AutomationStepsRepository,
    AutomationsHandler,
    AutomationRunnerService,
  ],
  controllers: [AutomationsController, AutomationStepsController],
  exports: [AutomationsService, AutomationRunnerService, AutomationStepsService],
})
export class AutomationsModule {}
