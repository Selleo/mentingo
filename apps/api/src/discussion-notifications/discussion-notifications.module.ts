import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { CourseChatModule } from "src/course-chat/course-chat.module";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { DiscussionReplyNotificationHandler } from "src/discussion-notifications/discussion-reply-notification.handler";
import { DiscussionReplyNotificationService } from "src/discussion-notifications/discussion-reply-notification.service";
import { ForumModule } from "src/forum/forum.module";

@Module({
  imports: [AnnouncementsModule, CourseChatModule, ForumModule],
  providers: [
    DiscussionNotificationsRepository,
    DiscussionReplyNotificationService,
    DiscussionReplyNotificationHandler,
  ],
})
export class DiscussionNotificationsModule {}
