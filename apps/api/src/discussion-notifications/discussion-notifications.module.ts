import { Module } from "@nestjs/common";

import { AnnouncementsModule } from "src/announcements/announcements.module";
import { CourseChatModule } from "src/course-chat/course-chat.module";
import { DiscussionEmailLinksModule } from "src/discussion-notifications/discussion-email-links.module";
import { DiscussionNotificationsController } from "src/discussion-notifications/discussion-notifications.controller";
import { DiscussionNotificationsRepository } from "src/discussion-notifications/discussion-notifications.repository";
import { DiscussionReplyDigestCron } from "src/discussion-notifications/discussion-reply-digest.cron";
import { DiscussionReplyDigestService } from "src/discussion-notifications/discussion-reply-digest.service";
import { DiscussionReplyNotificationHandler } from "src/discussion-notifications/discussion-reply-notification.handler";
import { DiscussionReplyNotificationService } from "src/discussion-notifications/discussion-reply-notification.service";
import { DiscussionUnsubscribeService } from "src/discussion-notifications/discussion-unsubscribe.service";
import { ForumModule } from "src/forum/forum.module";
import { SettingsModule } from "src/settings/settings.module";

@Module({
  imports: [
    AnnouncementsModule,
    CourseChatModule,
    DiscussionEmailLinksModule,
    ForumModule,
    SettingsModule,
  ],
  controllers: [DiscussionNotificationsController],
  providers: [
    DiscussionNotificationsRepository,
    DiscussionReplyNotificationService,
    DiscussionReplyNotificationHandler,
    DiscussionReplyDigestService,
    DiscussionReplyDigestCron,
    DiscussionUnsubscribeService,
  ],
})
export class DiscussionNotificationsModule {}
