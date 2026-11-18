import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";

import { ForumUserMentionedEvent } from "src/events/forum/forum-user-mentioned.event";
import { ForumMentionEmailHandler } from "src/forum/handlers/forum-mention-email.handler";

describe("ForumMentionEmailHandler", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";
  const topicId = "00000000-0000-0000-0000-000000000002";
  const actorUserId = "00000000-0000-0000-0000-000000000003";
  const mentionedUserId = "00000000-0000-0000-0000-000000000004";
  const postId = "00000000-0000-0000-0000-000000000005";
  const post = { content: "@Bea Target please review", deletedAt: null };
  const mentionedUser = {
    id: mentionedUserId,
    email: "bea@example.com",
    firstName: "Bea",
    lastName: "Target",
    language: "pl",
  };

  const createHandler = (overrides: { post?: object | null; recipient?: object } = {}) => {
    const captureNotificationRecipient = jest.fn().mockResolvedValue(undefined);
    const handler = new ForumMentionEmailHandler(
      {
        findTopicTitle: jest.fn().mockResolvedValue("Release notes"),
        findUserFullName: jest.fn().mockResolvedValue("Anna Admin"),
        findPostById: jest.fn().mockResolvedValue("post" in overrides ? overrides.post : post),
        findEmailRecipients: jest.fn().mockResolvedValue([overrides.recipient ?? mentionedUser]),
      } as never,
      {
        runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<void>) =>
          callback(),
        ),
      } as never,
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
    const handle = () =>
      handler.handleOutboxEvent(
        new ForumUserMentionedEvent({
          tenantId,
          topicId,
          postId,
          actorUserId,
          mentionedUserIds: [mentionedUserId],
        }),
        { eventId: "event-1" },
      );

    return { handle, captureNotificationRecipient };
  };

  it("emails the mentioned user in their language with a link to the topic", async () => {
    const { handle, captureNotificationRecipient } = createHandler();

    await handle();

    expect(captureNotificationRecipient).toHaveBeenCalledWith(
      { to: mentionedUser.email },
      {
        tenantId,
        template: {
          event: EMAIL_TEMPLATE_EVENTS.FORUM_MENTION,
          language: "pl",
          variables: {
            userEmail: mentionedUser.email,
            userFirstName: "Bea",
            userLastName: "Target",
            authorFullName: "Anna Admin",
            topic_title: "Release notes",
            message: post.content,
            topic_link: `https://tenant.example.com/forum/topics/${topicId}`,
          },
        },
      },
    );
  });

  it("writes in English to a user without a saved language", async () => {
    const { handle, captureNotificationRecipient } = createHandler({
      recipient: { ...mentionedUser, language: null },
    });

    await handle();

    expect(captureNotificationRecipient).toHaveBeenCalledWith(
      { to: mentionedUser.email },
      expect.objectContaining({ template: expect.objectContaining({ language: "en" }) }),
    );
  });

  it("sends nothing when the post was deleted", async () => {
    const { handle, captureNotificationRecipient } = createHandler({
      post: { ...post, deletedAt: "2026-11-18T10:00:00.000Z" },
    });

    await handle();

    expect(captureNotificationRecipient).not.toHaveBeenCalled();
  });
});
