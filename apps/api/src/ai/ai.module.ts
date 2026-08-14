import { Module } from "@nestjs/common";

import { AiPracticeQueueService } from "src/ai/ai-practice.queue.service";
import { AiPracticeWorker } from "src/ai/ai-practice.worker";
import { AiController } from "src/ai/ai.controller";
import { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.service";
import { AiJudgeConfigurationGeneratorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generator.service";
import { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-validator.service";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { AiPracticeContentGeneratorService } from "src/ai/services/ai-practice-content-generator.service";
import { AiPracticeService } from "src/ai/services/ai-practice.service";
import { AiRuntimeService } from "src/ai/services/ai-runtime.service";
import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { RagService } from "src/ai/services/rag.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

@Module({
  imports: [StudentLessonProgressModule, LocalizationModule, PermissionsModule],
  controllers: [AiController],
  providers: [
    AiJudgeConfigurationGeneratorService,
    AiJudgeConfigurationGenerationWorkflowService,
    AiJudgeConfigurationValidatorService,
    AiPracticeContentGeneratorService,
    ChatService,
    AiRuntimeService,
    AiService,
    AiRepository,
    TokenService,
    ThreadService,
    MessageService,
    PromptService,
    JudgeService,
    SummaryService,
    RagService,
    RagRepository,
    AiPracticeService,
    AiPracticeQueueService,
    AiPracticeWorker,
  ],
  exports: [
    AiJudgeConfigurationGenerationWorkflowService,
    AiJudgeConfigurationValidatorService,
    AiService,
    AiRuntimeService,
    AiRepository,
    ThreadService,
  ],
})
export class AiModule {}
