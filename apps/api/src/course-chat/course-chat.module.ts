import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/emails/emails.module";
import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import { CourseChatController } from "src/course-chat/course-chat.controller";
import { CourseChatGateway } from "src/course-chat/course-chat.gateway";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatService } from "src/course-chat/course-chat.service";

@Module({
  imports: [EmailModule],
  controllers: [CourseChatController],
  providers: [
    CourseChatService,
    CourseChatRepository,
    CourseChatPresenceService,
    CourseChatGateway,
  ],
  exports: [CourseChatService],
})
export class CourseChatModule {}
