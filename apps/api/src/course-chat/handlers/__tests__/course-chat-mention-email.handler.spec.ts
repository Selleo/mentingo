import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { CourseChatMentionEmailHandler } from "src/course-chat/handlers/course-chat-mention-email.handler";
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
    };
    const createAnnouncement = jest.fn().mockResolvedValue(undefined);
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
    );

    await handler.handle(
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
    );

    expect(courseChatRepository.getLocalizedCourseTitles).toHaveBeenCalledWith(courseId);
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
        },
        usersToNotify: [mentionedUserId],
      }),
    );
  });
});
