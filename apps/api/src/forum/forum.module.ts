import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { CourseChatModule } from "src/course-chat/course-chat.module";
import { ForumController } from "src/forum/forum.controller";
import { ForumGateway } from "src/forum/forum.gateway";
import { ForumRepository } from "src/forum/forum.repository";
import { ForumService } from "src/forum/forum.service";
import { ForumMentionEmailHandler } from "src/forum/handlers/forum-mention-email.handler";
import { ForumMentionNotificationHandler } from "src/forum/handlers/forum-mention-notification.handler";
import { LocalizationModule } from "src/localization/localization.module";
import { SettingsModule } from "src/settings/settings.module";

@Module({
  imports: [AnnouncementsModule, CourseChatModule, LocalizationModule, SettingsModule],
  controllers: [ForumController],
  providers: [
    ForumService,
    ForumRepository,
    ForumGateway,
    ForumMentionEmailHandler,
    ForumMentionNotificationHandler,
  ],
  exports: [ForumRepository],
})
export class ForumModule {}
