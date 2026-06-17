import { Module } from "@nestjs/common";

import { CourseChatPresenceService } from "src/course-chat/course-chat-presence.service";
import { CourseChatPresenceStore } from "src/course-chat/course-chat-presence.store";
import { CourseChatController } from "src/course-chat/course-chat.controller";
import { CourseChatGateway } from "src/course-chat/course-chat.gateway";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseChatService } from "src/course-chat/course-chat.service";
import { FileModule } from "src/file/files.module";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

@Module({
  imports: [FileModule, LocalizationModule, SettingsModule],
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
