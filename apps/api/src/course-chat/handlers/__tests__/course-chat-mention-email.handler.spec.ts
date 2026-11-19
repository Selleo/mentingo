import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { CourseChatMentionEmailHandler } from "src/course-chat/handlers/course-chat-mention-email.handler";
import { UserNotificationsCreatedEvent } from "src/events/announcement/user-notifications-created.event";
import { CourseChatUserMentionedEvent } from "src/events/course-chat/course-chat-user-mentioned.event";

describe("CourseChatMentionEmailHandler", () => {
  it("uses the localized course title in every announcement translation", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000001";
    const courseId = "00000000-0000-0000-0000-000000000002";
    const actorId = "00000000-0000-0000-0000-000000000003";
    const mentionedUserId = "00000000-0000-0000-0000-000000000004";
    const localizedCourseTitles = {
      en: "Safety",
      pl: "Bezpieczeństwo",
      de: "Sicherheit",
      lt: "Sauga",
      cs: "Bezpečnost",
      es: "Seguridad",
      fr: "Sécurité",
    };
    const createAnnouncement = jest.fn().mockResolvedValue(undefined);
    const publish = jest.fn().mockResolvedValue(undefined);
    const courseChatRepository = {
      getMessageById: jest.fn().mockResolvedValue(null),
      getMentionEmailRecipients: jest.fn().mockResolvedValue([]),
      getLocalizedCourseTitles: jest.fn().mockResolvedValue(localizedCourseTitles),
    };
    const dbAdmin = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ host: "https://tenant.example.com" }]),
      }),
    };
    const tenantRunner = {
      runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<void>) =>
        callback(),
      ),
    };
    const handler = new CourseChatMentionEmailHandler(
      courseChatRepository as never,
      { createAnnouncement } as never,
      {} as never,
      {
        getUserById: jest.fn().mockResolvedValue({ firstName: "Anna", lastName: "Admin" }),
      } as never,
      tenantRunner as never,
      dbAdmin as never,
      {
        publishCollectedNotifications: (_eventId: string, prepare: () => Promise<void>) =>
          prepare(),
      } as never,
      { publish } as never,
    );

    await handler.handleOutboxEvent(
      new CourseChatUserMentionedEvent({
        tenantId,
        courseId,
        messageId: "00000000-0000-0000-0000-000000000005",
        mentionedUserIds: [mentionedUserId],
        currentUser: {
          userId: actorId,
          email: "anna@example.com",
          roleSlugs: [],
          permissions: [],
          tenantId,
        },
      }),
      { eventId: "event-1" },
    );

    expect(courseChatRepository.getLocalizedCourseTitles).toHaveBeenCalledWith(courseId);
    expect(publish).toHaveBeenCalledWith(
      new UserNotificationsCreatedEvent({ userIds: [mentionedUserId] }),
    );
    expect(createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
        content: {
          en: 'In the course "Safety"',
          pl: 'W kursie "Bezpieczeństwo"',
          de: 'Im Kurs "Sicherheit"',
          lt: 'Kurse "Sauga"',
          cs: 'V kurzu "Bezpečnost"',
          es: 'En el curso "Seguridad"',
          fr: "Dans le cours « Sécurité »",
        },
        sourceId: courseId,
        usersToNotify: [mentionedUserId],
      }),
    );
  });

  it("emails only the mentioned users who keep mention emails switched on", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000001";
    const courseId = "00000000-0000-0000-0000-000000000002";
    const recipient = (id: string, mentionEmailsEnabled: boolean) => ({
      id,
      email: `${id}@example.com`,
      firstName: "Bea",
      lastName: "Target",
      tenantId,
      mentionEmailsEnabled,
    });
    const subscribed = recipient("00000000-0000-0000-0000-000000000004", true);
    const unsubscribed = recipient("00000000-0000-0000-0000-000000000006", false);
    const createAnnouncement = jest.fn().mockResolvedValue(undefined);
    const captureNotificationRecipient = jest.fn().mockResolvedValue(undefined);
    const handler = new CourseChatMentionEmailHandler(
      {
        getMessageById: jest.fn().mockResolvedValue({ content: "@Bea Target please review" }),
        getMentionEmailRecipients: jest.fn().mockResolvedValue([subscribed, unsubscribed]),
        getLocalizedCourseTitles: jest.fn().mockResolvedValue({ en: "Safety" }),
        getCourseEmailContext: jest.fn().mockResolvedValue({ title: "Safety" }),
      } as never,
      { createAnnouncement } as never,
      { getDefaultEmailProperties: jest.fn().mockResolvedValue({ language: "en" }) } as never,
      {
        getUserById: jest.fn().mockResolvedValue({ firstName: "Anna", lastName: "Admin" }),
      } as never,
      {
        runWithTenant: jest.fn(async (_tenantId: string, callback: () => Promise<void>) =>
          callback(),
        ),
      } as never,
      {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue([{ host: "https://tenant.example.com" }]),
        }),
      } as never,
      {
        publishCollectedNotifications: (_eventId: string, prepare: () => Promise<void>) =>
          prepare(),
        captureNotificationRecipient,
      } as never,
      { publish: jest.fn().mockResolvedValue(undefined) } as never,
    );

    await handler.handleOutboxEvent(
      new CourseChatUserMentionedEvent({
        tenantId,
        courseId,
        messageId: "00000000-0000-0000-0000-000000000005",
        mentionedUserIds: [subscribed.id, unsubscribed.id],
        currentUser: {
          userId: "00000000-0000-0000-0000-000000000003",
          email: "anna@example.com",
          roleSlugs: [],
          permissions: [],
          tenantId,
        },
      }),
      { eventId: "event-1" },
    );

    expect(createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ usersToNotify: [subscribed.id, unsubscribed.id] }),
    );
    expect(captureNotificationRecipient).toHaveBeenCalledTimes(1);
    expect(captureNotificationRecipient).toHaveBeenCalledWith(
      { to: subscribed.email },
      expect.anything(),
    );
  });
});
