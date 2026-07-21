import { Module } from "@nestjs/common";

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
  ],
  controllers: [AutomationsController, AutomationStepsController],
  exports: [AutomationsService],
})
export class AutomationsModule {}
