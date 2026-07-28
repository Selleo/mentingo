import { Test } from "@nestjs/testing";

import { AnnouncementsRepository } from "src/announcements/announcements.repository";
import { CourseChatRepository } from "src/course-chat/course-chat.repository";
import { CourseService } from "src/courses/course.service";
import {
  AnnouncementPublishedEvent,
  CertificateArchivedEmailEvent,
  CertificateExpirationWarningEmailEvent,
  CourseChatUserMentionedEvent,
  CourseDueDateReminderEmailEvent,
  UserFirstLoginEvent,
  UserInviteEvent,
  UserPasswordCreatedEvent,
  UserPasswordReminderEvent,
  UserRegisteredEvent,
  UsersImportInviteEmailsEvent,
  UsersLongInactivityEvent,
  UsersShortInactivityEvent,
  UserWelcomeEvent,
} from "src/events";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";

import { AutomationDataResolverService } from "./automation-data-resolver.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

// Mock resolveTenantOrigin
jest.mock("src/common/helpers/resolveTenantOrigin", () => ({
  resolveTenantOrigin: jest.fn().mockResolvedValue("https://app.test.com"),
}));

describe("AutomationDataResolverService", () => {
  let service: AutomationDataResolverService;
  let announcementsRepository: jest.Mocked<AnnouncementsRepository>;
  let courseChatRepository: jest.Mocked<CourseChatRepository>;

  const tenantId = "tenant-1" as UUIDType;
  const userId = "user-1" as UUIDType;

  const mockUser = {
    id: userId,
    firstName: "Jan",
    lastName: "Kowalski",
    email: "jan@example.com",
    tenantId,
  };

  beforeEach(async () => {
    const dbAdminMock = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ tenantId }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationDataResolverService,
        {
          provide: UserService,
          useValue: {
            getUserById: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: CourseService,
          useValue: {
            getCourseEmailData: jest.fn().mockResolvedValue({
              courseName: "Test Course",
              hasCertificate: false,
            }),
            getChapterName: jest.fn().mockResolvedValue("Chapter 1"),
            getStudentsDueDatesForCourse: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AnnouncementsRepository,
          useValue: {
            getAnnouncementById: jest.fn(),
            getAnnouncementEmailRecipients: jest.fn(),
          },
        },
        {
          provide: CourseChatRepository,
          useValue: {
            getMessageById: jest.fn(),
          },
        },
        {
          provide: TenantDbRunnerService,
          useValue: {
            runWithTenant: jest.fn().mockImplementation((_tid, fn) => fn()),
          },
        },
        {
          provide: DB_ADMIN,
          useValue: dbAdminMock,
        },
      ],
    }).compile();

    service = module.get(AutomationDataResolverService);
    userService = module.get(UserService);
    courseService = module.get(CourseService);
    announcementsRepository = module.get(AnnouncementsRepository);
    courseChatRepository = module.get(CourseChatRepository);
    tenantRunner = module.get(TenantDbRunnerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("resolve - UserInviteEvent", () => {
    it("resolves recipient with invite link variables", async () => {
      const event = new UserInviteEvent({
        email: "jan@example.com",
        userId,
        tenantId,
        token: "token-abc",
        invitedByUserName: "Admin",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].userEmail).toBe("jan@example.com");
      expect(result[0].tenantId).toBe(tenantId);
      expect(result[0].variables.inviteLink).toContain("token-abc");
      expect(result[0].variables.invitedByUserName).toBe("Admin");
      expect(result[0].variables.userFirstName).toBe("Jan");
      expect(result[0].variables.userLastName).toBe("Kowalski");
    });

    it("defaults invitedByUserName to Admin when not provided", async () => {
      const event = new UserInviteEvent({
        email: "jan@example.com",
        userId,
        tenantId,
        token: "token-abc",
        invitedByUserName: undefined as any,
      });

      const result = await service.resolve(event);

      expect(result[0].variables.invitedByUserName).toBe("Admin");
    });
  });

  describe("resolve - UsersImportInviteEmailsEvent", () => {
    it("resolves multiple recipients from import", async () => {
      const event = new UsersImportInviteEmailsEvent({
        tenantId,
        creatorId: "creator-1" as UUIDType,
        recipients: [
          { userId: "user-1" as UUIDType, email: "a@test.com", token: "tok-1" },
          { userId: "user-2" as UUIDType, email: "b@test.com", token: "tok-2" },
        ],
        invitedByUserName: "Manager",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(2);
      expect(result[0].userEmail).toBe("a@test.com");
      expect(result[0].variables.inviteLink).toContain("tok-1");
      expect(result[1].userEmail).toBe("b@test.com");
      expect(result[1].variables.invitedByUserName).toBe("Manager");
    });
  });

  describe("resolve - UserPasswordReminderEvent", () => {
    it("resolves recipient with reset password link", async () => {
      const event = new UserPasswordReminderEvent({
        email: "jan@example.com",
        userId,
        tenantId,
        token: "reset-token",
        origin: "https://app.test.com",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.resetPasswordLink).toContain("reset-token");
    });
  });

  describe("resolve - UserWelcomeEvent", () => {
    it("resolves recipient with platformUrl", async () => {
      const event = new UserWelcomeEvent({
        email: "jan@example.com",
        userId,
        tenantId,
        origin: "https://app.test.com",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.platformUrl).toContain("/courses");
    });
  });

  describe("resolve - UserFirstLoginEvent", () => {
    it("resolves recipient with loginDate and platformUrl", async () => {
      const event = new UserFirstLoginEvent({ userId });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.loginDate).toBeDefined();
      expect(result[0].variables.platformUrl).toContain("/courses");
    });
  });

  describe("resolve - UsersShortInactivityEvent", () => {
    it("resolves multiple inactive users", async () => {
      const event = new UsersShortInactivityEvent({
        tenantId,
        users: [
          { userId: "user-1" as UUIDType, email: "a@test.com", name: "Jan Kowalski" },
          { userId: "user-2" as UUIDType, email: "b@test.com", name: "Anna Nowak" },
        ],
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(2);
      expect(result[0].variables.userFirstName).toBe("Jan");
      expect(result[0].variables.userLastName).toBe("Kowalski");
      expect(result[1].variables.userFirstName).toBe("Anna");
      expect(result[1].variables.userLastName).toBe("Nowak");
    });
  });

  describe("resolve - UsersLongInactivityEvent", () => {
    it("resolves multiple inactive users", async () => {
      const event = new UsersLongInactivityEvent({
        tenantId,
        users: [{ userId: "user-1" as UUIDType, email: "a@test.com", name: "Jan Kowalski" }],
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].userEmail).toBe("a@test.com");
    });
  });

  describe("resolve - UserRegisteredEvent", () => {
    it("resolves with profileLink and registrationDate", async () => {
      const event = new UserRegisteredEvent({
        id: userId,
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan@example.com",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.profileLink).toContain("/admin/users/");
      expect(result[0].variables.registrationDate).toBeDefined();
      expect(result[0].variables.userName).toBe("Jan Kowalski");
    });
  });

  describe("resolve - UserPasswordCreatedEvent", () => {
    it("resolves with createdAt timestamp", async () => {
      const event = new UserPasswordCreatedEvent({
        id: userId,
        firstName: "Jan",
        lastName: "Kowalski",
        email: "jan@example.com",
      });

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.createdAt).toBeDefined();
    });
  });

  describe("resolve - CertificateExpirationWarningEmailEvent", () => {
    it("resolves multiple certificates", async () => {
      const event = new CertificateExpirationWarningEmailEvent({
        certificates: [
          {
            userId,
            userEmail: "jan@example.com",
            tenantId,
            courseName: "BHP 2025",
            expiresAt: "2025-12-31",
            courseLink: "https://app.test.com/course/c1",
          },
        ],
      } as any);

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.certificateName).toBe("BHP 2025");
      expect(result[0].variables.expirationDate).toBe("2025-12-31");
      expect(result[0].variables.courseUrl).toBe("https://app.test.com/course/c1");
    });
  });

  describe("resolve - CertificateArchivedEmailEvent", () => {
    it("resolves with archiveReason", async () => {
      const event = new CertificateArchivedEmailEvent({
        certificates: [
          {
            userId,
            userEmail: "jan@example.com",
            tenantId,
            courseName: "BHP 2025",
            courseLink: "https://app.test.com/course/c1",
          },
        ],
        reason: "manual_reset",
      } as any);

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.archiveReason).toBe("manual_reset");
      expect(result[0].variables.archivedAt).toBeDefined();
    });
  });

  describe("resolve - AnnouncementPublishedEvent", () => {
    it("returns empty when announcement not found", async () => {
      announcementsRepository.getAnnouncementById.mockResolvedValue([]);

      const event = new AnnouncementPublishedEvent({
        announcementId: "ann-1" as UUIDType,
      } as any);

      const result = await service.resolve(event);
      expect(result).toEqual([]);
    });

    it("returns empty when no recipients for announcement", async () => {
      announcementsRepository.getAnnouncementById.mockResolvedValue([
        {
          tenantId,
          title: { pl: "Title" },
          content: { pl: "Content" },
        },
      ] as any);
      announcementsRepository.getAnnouncementEmailRecipients.mockResolvedValue([]);

      const event = new AnnouncementPublishedEvent({
        announcementId: "ann-1" as UUIDType,
      } as any);

      const result = await service.resolve(event);
      expect(result).toEqual([]);
    });

    it("resolves recipients with announcement data", async () => {
      announcementsRepository.getAnnouncementById.mockResolvedValue([
        {
          tenantId,
          title: { pl: "Nowe szkolenie" },
          content: { pl: "Zapraszamy" },
        },
      ] as any);
      announcementsRepository.getAnnouncementEmailRecipients.mockResolvedValue([
        { id: userId, email: "jan@example.com" },
      ] as any);

      const event = new AnnouncementPublishedEvent({
        announcementId: "ann-1" as UUIDType,
      } as any);

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.announcementTitle).toBe("Nowe szkolenie");
      expect(result[0].variables.announcementContent).toBe("Zapraszamy");
      expect(result[0].variables.announcementUrl).toContain("/announcements");
    });
  });

  describe("resolve - CourseChatUserMentionedEvent", () => {
    it("returns empty when message not found", async () => {
      courseChatRepository.getMessageById.mockResolvedValue(null as any);

      const event = new CourseChatUserMentionedEvent({
        tenantId,
        courseId: "course-1" as UUIDType,
        actorUserId: "actor-1" as UUIDType,
        messageId: "msg-1" as UUIDType,
        mentionedUserIds: [userId],
      } as any);

      const result = await service.resolve(event);
      expect(result).toEqual([]);
    });

    it("excludes the actor from recipients", async () => {
      const actorId = "actor-1" as UUIDType;
      courseChatRepository.getMessageById.mockResolvedValue({
        userFirstName: "Actor",
        userLastName: "User",
        content: "Hey @Jan",
      } as any);

      const event = new CourseChatUserMentionedEvent({
        tenantId,
        courseId: "course-1" as UUIDType,
        actorUserId: actorId,
        messageId: "msg-1" as UUIDType,
        mentionedUserIds: [actorId, userId],
      } as any);

      const result = await service.resolve(event);

      // Actor excluded, only userId remains
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(userId);
    });
  });

  describe("resolve - CourseDueDateReminderEmailEvent", () => {
    it("resolves recipients with course due date data", async () => {
      const event = new CourseDueDateReminderEmailEvent({
        recipients: [
          {
            studentId: userId,
            studentEmail: "jan@example.com",
            tenantId,
            courseName: "BHP Course",
            dueDate: "2025-08-15",
            daysBeforeDueDate: 7,
            courseId: "course-1" as UUIDType,
            tenantHost: "https://app.test.com/",
          },
        ],
      } as any);

      const result = await service.resolve(event);

      expect(result).toHaveLength(1);
      expect(result[0].variables.courseName).toBe("BHP Course");
      expect(result[0].variables.dueDate).toBe("2025-08-15");
      expect(result[0].variables.daysLeft).toBe("7");
      expect(result[0].variables.courseUrl).toContain("/course/course-1");
    });
  });

  describe("resolve - unknown event", () => {
    it("returns empty array for unrecognized event type", async () => {
      const unknownEvent = { constructor: { name: "UnknownEvent" } } as any;

      const result = await service.resolve(unknownEvent);
      expect(result).toEqual([]);
    });
  });
});
