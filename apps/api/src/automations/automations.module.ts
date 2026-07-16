import { Module } from "@nestjs/common";

import { AutomationsRepository } from "./repositories/automations/automations.repository";

@Module({
  providers: [AutomationsRepository, AutomationsRepository],
})
export class AutomationsModule {}
