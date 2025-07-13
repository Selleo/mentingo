import { Module } from "@nestjs/common";

import { AiController } from "src/ai/ai.controller";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { JudgeService } from "src/ai/services/judge.service";
import { MessageService } from "src/ai/services/message.service";
import { PromptService } from "src/ai/services/prompt.service";
import { SummaryService } from "src/ai/services/summary.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { LessonModule } from "src/lesson/lesson.module";

@Module({
  imports: [LessonModule],
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
  ],
})
export class AiModule {}
