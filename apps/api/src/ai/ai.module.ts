import { Module } from "@nestjs/common";

import { AiController } from "src/ai/ai.controller";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { RagRepository } from "src/ai/repositories/rag.repository";
import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { RagService } from "src/ai/services/rag.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { StudentLessonProgressModule } from "src/studentLessonProgress/studentLessonProgress.module";

@Module({
  imports: [StudentLessonProgressModule],
  controllers: [AiController],
  providers: [
    ChatService,
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
  ],
  exports: [AiService, AiRepository],
})
export class AiModule {}
