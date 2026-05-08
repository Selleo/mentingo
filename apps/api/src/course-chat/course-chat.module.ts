import { Module } from "@nestjs/common";

import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import { CourseChatPresenceStore } from "src/course-chat/course-chat-presence.store";
import { CourseChatController } from "src/course-chat/course-chat.controller";
import { CourseChatGateway } from "src/course-chat/course-chat.gateway";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatService } from "src/course-chat/course-chat.service";
import { LocalizationModule } from "src/localization/localization.module";
import { S3Module } from "src/s3/s3.module";

@Module({
  imports: [LocalizationModule, S3Module],
  controllers: [CourseChatController],
  providers: [
    CourseChatService,
    CourseChatRepository,
    CourseChatPresenceService,
    CourseChatPresenceStore,
    CourseChatGateway,
  ],
  exports: [CourseChatService, CourseChatRepository],
})
export class CourseChatModule {}
