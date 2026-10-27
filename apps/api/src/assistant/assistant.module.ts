import { Module } from "@nestjs/common";

import { AiModule } from "src/ai/ai.module";
import { McpModule } from "src/mcp/mcp.module";
import { PermissionsModule } from "src/permissions/permissions.module";

import { AssistantExecutionService } from "./assistant-execution.service";
import { AssistantController } from "./assistant.controller";
import { AssistantRepository } from "./assistant.repository";
import { AssistantService } from "./assistant.service";
import { AssistantRuntimeService } from "./workflow/assistant-runtime.service";

@Module({
  imports: [AiModule, McpModule, PermissionsModule],
  controllers: [AssistantController],
  providers: [
    AssistantRepository,
    AssistantExecutionService,
    AssistantRuntimeService,
    AssistantService,
  ],
  exports: [AssistantRepository],
})
export class AssistantModule {}
