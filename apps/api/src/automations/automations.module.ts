import { Module } from "@nestjs/common";

import { AutomationsService } from "./automations.service";
import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsRepository, AutomationsService],
})
export class AutomationsModule {}
