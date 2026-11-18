import { Injectable } from "@nestjs/common";
import { ANNOUNCEMENT_SOURCE_TYPES, getCourseDiscussionThreadPath } from "@repo/shared";

import { getLocalizedUserMentionContentAnnouncement } from "src/course-chat/chat-mention-localizations/chat-mention-content-localization";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { DiscussionReplyNotificationService } from "src/discussion-notifications/discussion-reply-notification.service";
import { CourseChatReplyCreatedEvent } from "src/events/course-chat/course-chat-reply-created.event";
import { ForumReplyCreatedEvent } from "src/events/forum/forum-reply-created.event";
import { getLocalizedForumMentionContentAnnouncement } from "src/forum/forum-mention.localizations";
import { ForumRepository } from "src/forum/forum.repository";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import type { CourseChatReplyCreatedData } from "src/events/course-chat/course-chat-reply-created.event";
import type { ForumReplyCreatedData } from "src/events/forum/forum-reply-created.event";
import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type DiscussionReplyCreatedEvent = CourseChatReplyCreatedEvent | ForumReplyCreatedEvent;

@Injectable()
@OutboxEventsHandler(CourseChatReplyCreatedEvent, ForumReplyCreatedEvent)
export class DiscussionReplyNotificationHandler
  implements OutboxEventsHandlerOf<DiscussionReplyCreatedEvent>
{
  constructor(
    private readonly courseChatRepository: CourseChatRepository,
    private readonly forumRepository: ForumRepository,
    private readonly discussionReplyNotificationService: DiscussionReplyNotificationService,
  ) {}

  async handleOutboxEvent(event: DiscussionReplyCreatedEvent) {
    if (event instanceof CourseChatReplyCreatedEvent) {
      await this.notifyAboutCourseReply(event.courseChatReplyCreatedData);
      return;
    }

    await this.notifyAboutForumReply(event.forumReplyCreatedData);
  }

  private async notifyAboutCourseReply(reply: CourseChatReplyCreatedData) {
    const { courseId, parentMessageId } = reply;
    const [thread, courseTitles] = await Promise.all([
      this.courseChatRepository.getMessageContext(parentMessageId),
      this.courseChatRepository.getLocalizedCourseTitles(courseId),
    ]);

    if (!thread || !courseTitles) return;

    await this.discussionReplyNotificationService.notifyParticipants(
      {
        threadId: thread.threadId,
        actorUserId: reply.actorUserId,
        mentionedUserIds: reply.mentionedUserIds,
        content: getLocalizedUserMentionContentAnnouncement(courseTitles),
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_CHAT,
        sourceId: courseId,
        linkPath: getCourseDiscussionThreadPath(courseId, parentMessageId),
      },
      (userIds) => this.courseChatRepository.getEnrolledUserIds(courseId, userIds),
    );
  }

  private async notifyAboutForumReply(reply: ForumReplyCreatedData) {
    const topicTitle = await this.forumRepository.findTopicTitle(reply.topicId);

    if (!topicTitle) return;

    await this.discussionReplyNotificationService.notifyParticipants(
      {
        threadId: reply.topicId,
        actorUserId: reply.actorUserId,
        mentionedUserIds: reply.mentionedUserIds,
        content: getLocalizedForumMentionContentAnnouncement(topicTitle),
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM,
        sourceId: reply.topicId,
        linkPath: null,
      },
      async (userIds) => {
        const forumUsers = await this.forumRepository.findMentionableUsers(userIds);

        return forumUsers.map(({ id }) => id);
      },
    );
  }
}
