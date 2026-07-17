import { Module } from "@nestjs/common";

import { AutomationStepsService } from "./automations-steps/automations-steps.service";
import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsService, AutomationStepsService],
  controllers: [AutomationsController],
  exports: [AutomationsService],
})
export class AutomationsModule {}
