import { Module } from "@nestjs/common";

import { AiController } from "src/ai/ai.controller";
import { AiRepository } from "src/ai/repositories/ai.repository";
import { AiService } from "src/ai/services/ai.service";
import { ChatService } from "src/ai/services/chat.service";
import { ThreadService } from "src/ai/services/thread.service";
import { TokenService } from "src/ai/services/token.service";
import { LessonModule } from "src/lesson/lesson.module";

@Module({
  imports: [LessonModule],
  controllers: [AiController],
  providers: [AiService, AiRepository, TokenService, ThreadService, ChatService],
})
export class AiModule {}
