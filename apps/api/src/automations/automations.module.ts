import { Module } from "@nestjs/common";

import { AutomationsController } from "./automations.controller";
import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsRepository, AutomationsService],
  controllers: [AutomationsController],
})
export class AutomationsModule {}
