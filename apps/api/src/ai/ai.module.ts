import { Module } from "@nestjs/common";

import { AdminAiThreadsController } from "src/ai/admin-ai-threads.controller";
import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import { AiPracticeWorker } from "src/ai/ai-practice.worker";
import { AiRuntimeModule } from "src/ai/ai-runtime.module";
import { AiController } from "src/ai/ai.controller";
import { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.service";
import { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-validator.service";
import { AiMentorConfigurationGenerationWorkflowService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generation-workflow.service";
import { AiMentorConfigurationGeneratorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generator.service";
import { AiMentorConfigurationValidatorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-validator.service";
import { AdminAiThreadsRepository } from "src/ai/repositories/admin-ai-threads.repository";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AdminAiThreadsService } from "src/ai/services/admin-ai-threads.service";
import { AiPracticeService } from "src/ai/services/ai-practice.service";
import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

@Module({
  imports: [
    AiRuntimeModule,
    StudentLessonProgressModule,
    LocalizationModule,
    PermissionsModule,
    FileModule,
  ],
  controllers: [AiController, AdminAiThreadsController],
  providers: [
    AdminAiThreadsRepository,
    AdminAiThreadsService,
    AiJudgeConfigurationGeneratorService,
    AiJudgeConfigurationGenerationWorkflowService,
    AiJudgeConfigurationValidatorService,
    AiMentorConfigurationGeneratorService,
    AiMentorConfigurationGenerationWorkflowService,
    AiMentorConfigurationValidatorService,
    ChatService,
    AiService,
    AiRepository,
    TokenService,
    ThreadService,
    MessageService,
    PromptService,
    JudgeService,
    SummaryService,
    AiPracticeService,
    AiPracticeQueueService,
    AiPracticeWorker,
  ],
  exports: [
    AiRuntimeModule,
    AiJudgeConfigurationGenerationWorkflowService,
    AiJudgeConfigurationValidatorService,
    AiMentorConfigurationGenerationWorkflowService,
    AiMentorConfigurationValidatorService,
    AiService,
    AiRepository,
    ThreadService,
  ],
})
export class AiModule {}
