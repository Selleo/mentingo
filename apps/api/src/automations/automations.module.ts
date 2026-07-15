import { Module } from "@nestjs/common";

import { AutomationsRepository } from "./repositories/automations/automations.repository";
import { AutomationsRepository } from "./repositories/automations.repository/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsRepository],
})
export class AutomationsModule {}
