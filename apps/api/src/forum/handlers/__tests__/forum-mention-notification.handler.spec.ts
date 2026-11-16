import { ANNOUNCEMENT_SOURCE_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { ForumMentionNotificationHandler } from "src/forum/handlers/forum-mention-notification.handler";

describe("ForumMentionNotificationHandler", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const topicId = "00000000-0000-0000-0000-000000000002";
  const actorUserId = "00000000-0000-0000-0000-000000000003";
  const mentionedUserId = "00000000-0000-0000-0000-000000000004";

  const createHandler = (topicTitle: string | null) => {
    const createAnnouncement = jest.fn().mockResolvedValue(undefined);
    const runWithTenant = jest.fn(async (_tenantId: string, callback: () => Promise<void>) =>
      callback(),
    );
    const handler = new ForumMentionNotificationHandler(
      {
        findTopicTitle: jest.fn().mockResolvedValue(topicTitle),
        findUserFullName: jest.fn().mockResolvedValue("Anna Admin"),
      } as never,
      { createAnnouncement } as never,
      { runWithTenant } as never,
    );

    return { handler, createAnnouncement, runWithTenant };
  };

  const buildEvent = (mentionedUserIds: string[]) =>
    new ForumUserMentionedEvent({
      tenantId,
      topicId,
      postId: "00000000-0000-0000-0000-000000000005",
      actorUserId,
      mentionedUserIds,
    });

  it("creates a notification that links to the topic for every mentioned user", async () => {
    const { handler, createAnnouncement, runWithTenant } = createHandler("Release notes");

    await handler.handleOutboxEvent(buildEvent([mentionedUserId]));

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

  it("skips the notification when nobody is mentioned or the topic is gone", async () => {
    const withoutMentions = createHandler("Release notes");
    await withoutMentions.handler.handleOutboxEvent(buildEvent([]));
    expect(withoutMentions.createAnnouncement).not.toHaveBeenCalled();

    const withoutTopic = createHandler(null);
    await withoutTopic.handler.handleOutboxEvent(buildEvent([mentionedUserId]));
    expect(withoutTopic.createAnnouncement).not.toHaveBeenCalled();
  });
});
