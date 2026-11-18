import { ANNOUNCEMENT_SOURCE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { ForumMentionNotificationHandler } from "src/forum/handlers/forum-mention-notification.handler";

describe("ForumMentionNotificationHandler", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const topicId = "00000000-0000-0000-0000-000000000002";
  const actorUserId = "00000000-0000-0000-0000-000000000003";
  const mentionedUserId = "00000000-0000-0000-0000-000000000004";
  const defaultPost = { content: "@Bea Target please review", deletedAt: null };

  const postId = "00000000-0000-0000-0000-000000000005";
  const mentionedUser = {
    id: mentionedUserId,
    email: "bea@example.com",
    firstName: "Bea",
    lastName: "Target",
  };

  const createHandler = (topicTitle: string | null, post: object | null = defaultPost) => {
    const createAnnouncement = jest.fn().mockResolvedValue(undefined);
    const publish = jest.fn().mockResolvedValue(undefined);
    const captureNotificationRecipient = jest.fn().mockResolvedValue(undefined);
    const runWithTenant = jest.fn(async (_tenantId: string, callback: () => Promise<void>) =>
      callback(),
    );
    const handler = new ForumMentionNotificationHandler(
      {
        findTopicTitle: jest.fn().mockResolvedValue(topicTitle),
        findUserFullName: jest.fn().mockResolvedValue("Anna Admin"),
        findPostById: jest.fn().mockResolvedValue(post),
        findMentionEmailRecipients: jest.fn().mockResolvedValue([mentionedUser]),
      } as never,
      { createAnnouncement } as never,
      { runWithTenant } as never,
      { publish } as never,
      { getDefaultEmailProperties: jest.fn().mockResolvedValue({ language: "pl" }) } as never,
      {
        publishCollectedNotifications: (_eventId: string, prepare: () => Promise<void>) =>
          prepare(),
        captureNotificationRecipient,
      } as never,
      {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([{ host: "https://tenant.example.com" }]),
        }),
      } as never,
    );
    const handle = (event: ForumUserMentionedEvent) =>
      handler.handleOutboxEvent(event, { eventId: "event-1" });

    return { handle, createAnnouncement, runWithTenant, publish, captureNotificationRecipient };
  };

  const buildEvent = (mentionedUserIds: string[]) =>
    new ForumUserMentionedEvent({
      tenantId,
      topicId,
      postId,
      actorUserId,
      mentionedUserIds,
    });

  it("creates a notification that links to the topic for every mentioned user", async () => {
    const { handle, createAnnouncement, runWithTenant } = createHandler("Release notes");

    await handle(buildEvent([mentionedUserId]));

    expect(runWithTenant).toHaveBeenCalledWith(tenantId, expect.any(Function));
    expect(createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
        authorId: actorUserId,
        sourceType: ANNOUNCEMENT_SOURCE_TYPES.FORUM,
        sourceId: topicId,
        usersToNotify: [mentionedUserId],
        sendEmail: false,
        title: expect.objectContaining({ en: "Anna Admin mentioned you" }),
        content: expect.objectContaining({
          en: 'In the forum topic "Release notes"',
          pl: 'W temacie na forum "Release notes"',
        }),
      }),
    );
  });

  it("asks for the mentioned users' notification counters to be refreshed", async () => {
    const { handle, publish } = createHandler("Release notes");

    await handle(buildEvent([mentionedUserId]));

    expect(publish).toHaveBeenCalledWith(
      new UserNotificationsCreatedEvent({ userIds: [mentionedUserId] }),
    );
  });

  it("emails every mentioned user in their language, with a link to the topic", async () => {
    const { handle, captureNotificationRecipient } = createHandler("Release notes");

    await handle(buildEvent([mentionedUserId]));

    expect(captureNotificationRecipient).toHaveBeenCalledWith(
      { to: mentionedUser.email },
      {
        tenantId,
        template: {
          event: "forum_mention",
          language: "pl",
          variables: {
            userEmail: mentionedUser.email,
            userFirstName: mentionedUser.firstName,
            userLastName: mentionedUser.lastName,
            authorFullName: "Anna Admin",
            topic_title: "Release notes",
            message: defaultPost.content,
            topic_link: `https://tenant.example.com/forum/topics/${topicId}`,
          },
        },
      },
    );
  });

  it("sends no email about a post that was deleted in the meantime", async () => {
    const { handle, createAnnouncement, captureNotificationRecipient } = createHandler(
      "Release notes",
      { ...defaultPost, deletedAt: "2026-11-18T10:00:00.000Z" },
    );

    await handle(buildEvent([mentionedUserId]));

    expect(createAnnouncement).toHaveBeenCalled();
    expect(captureNotificationRecipient).not.toHaveBeenCalled();
  });

  it("escapes the topic title, which is shown as HTML in the notification", async () => {
    const { handle, createAnnouncement } = createHandler(
      '<a href="https://evil.example">Click</a>',
    );

    await handle(buildEvent([mentionedUserId]));

    expect(createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          en: 'In the forum topic "&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt;"',
        }),
      }),
    );
  });

  it("skips the notification when nobody is mentioned or the topic is gone", async () => {
    const withoutMentions = createHandler("Release notes");
    await withoutMentions.handle(buildEvent([]));
    expect(withoutMentions.createAnnouncement).not.toHaveBeenCalled();
    expect(withoutMentions.publish).not.toHaveBeenCalled();

    const withoutTopic = createHandler(null);
    await withoutTopic.handle(buildEvent([mentionedUserId]));
    expect(withoutTopic.createAnnouncement).not.toHaveBeenCalled();
  });
});
