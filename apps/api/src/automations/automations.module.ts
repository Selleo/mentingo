import { Module } from "@nestjs/common";

import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationSteps } from "./repositories/automation-steps/automation-steps";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsService, AutomationSteps],
  controllers: [AutomationsController],
  exports: [AutomationsService],
})
export class AutomationsModule {}
