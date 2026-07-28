import { Test } from "@nestjs/testing";

import { EmailService } from "src/common/emails/emails.service";
import { DB_ADMIN } from "src/storage/db/db.providers";

import {
  AutomationSystemTemplateRendererService,
  isSystemTemplateId,
  SYSTEM_TEMPLATE_IDS,
} from "./automation-system-template-renderer.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationSystemTemplateRendererService", () => {
  let service: AutomationSystemTemplateRendererService;
  let emailService: jest.Mocked<EmailService>;

  const tenantId = "tenant-1" as UUIDType;
  const userId = "user-1" as UUIDType;

  const mockEmailSettings = {
    primaryColor: "#2563eb",
    companyName: "TestCo",
    language: "en" as const,
  };

  beforeEach(async () => {
    const dbAdminMock = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([{ origin: "https://app.test.com" }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationSystemTemplateRendererService,
        {
          provide: EmailService,
          useValue: {
            getDefaultEmailProperties: jest.fn().mockResolvedValue(mockEmailSettings),
          },
        },
        {
          provide: DB_ADMIN,
          useValue: dbAdminMock,
        },
      ],
    }).compile();

    service = module.get(AutomationSystemTemplateRendererService);
    emailService = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("isSystemTemplateId", () => {
    it("returns true for known system template ids", () => {
      expect(isSystemTemplateId("user_invite")).toBe(true);
      expect(isSystemTemplateId("welcome")).toBe(true);
      expect(isSystemTemplateId("announcement")).toBe(true);
      expect(isSystemTemplateId("new_user")).toBe(true);
    });

    it("returns false for unknown/custom template ids", () => {
      expect(isSystemTemplateId("custom-template-123")).toBe(false);
      expect(isSystemTemplateId("my_custom")).toBe(false);
      expect(isSystemTemplateId("")).toBe(false);
    });
  });

  describe("SYSTEM_TEMPLATE_IDS", () => {
    it("contains all expected system templates", () => {
      const expected = [
        "user_invite",
        "welcome",
        "user_first_login",
        "user_assigned_to_course",
        "user_short_inactivity",
        "user_long_inactivity",
        "user_finished_chapter",
        "user_finished_course",
        "create_password_reminder",
        "certificate_expiration_warning",
        "certificate_expired",
        "announcement",
        "course_due_date_reminder",
        "new_user",
        "finished_course",
      ];

      for (const id of expected) {
        expect(SYSTEM_TEMPLATE_IDS.has(id)).toBe(true);
      }
      expect(SYSTEM_TEMPLATE_IDS.size).toBe(expected.length);
    });
  });

  describe("render", () => {
    it("returns null for unknown template id", async () => {
      const result = await service.render(
        "nonexistent_template",
        { userFirstName: "Jan" },
        tenantId,
        userId,
        "en",
      );

      expect(result).toBeNull();
    });

    it("resolves email settings using emailService", async () => {
      await service.render(
        "welcome",
        { platformUrl: "https://app.test.com/courses" },
        tenantId,
        userId,
        "en",
      );

      expect(emailService.getDefaultEmailProperties).toHaveBeenCalledWith(tenantId, userId, "en");
    });

    it("renders user_invite template with variables", async () => {
      const variables = {
        invitedByUserName: "Admin",
        inviteLink: "https://app.test.com/create-password?createToken=abc",
      };

      const result = await service.render("user_invite", variables, tenantId, userId, "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBeDefined();
      expect(result!.html).toBeDefined();
      expect(result!.text).toBeDefined();
    });

    it("renders welcome template with platformUrl variable", async () => {
      const variables = { platformUrl: "https://app.test.com/courses" };

      const result = await service.render("welcome", variables, tenantId, userId, "en");

      expect(result).not.toBeNull();
      expect(result!.html).toBeDefined();
    });

    it("renders announcement template using title from variables as subject fallback", async () => {
      const variables = {
        announcementTitle: "Important Update",
        announcementContent: "Content here",
        announcementUrl: "https://app.test.com/announcements/1",
      };

      const result = await service.render("announcement", variables, tenantId, userId, "en");

      expect(result).not.toBeNull();
      // Announcement uses title directly as subject (no getEmailSubject mapping)
      expect(result!.subject).toBe("Important Update");
    });

    it("renders course_due_date_reminder with numeric daysLeft parsing", async () => {
      const variables = {
        courseName: "Test Course",
        courseUrl: "https://app.test.com/course/123",
        dueDate: "2025-08-15",
        daysLeft: "5",
      };

      const result = await service.render(
        "course_due_date_reminder",
        variables,
        tenantId,
        userId,
        "en",
      );

      expect(result).not.toBeNull();
      expect(result!.html).toBeDefined();
    });

    it("renders new_user template composing userName from firstName/lastName", async () => {
      const variables = {
        userFirstName: "Jan",
        userLastName: "Kowalski",
        profileLink: "https://app.test.com/admin/users/user-1",
      };

      const result = await service.render("new_user", variables, tenantId, userId, "en");

      expect(result).not.toBeNull();
      expect(result!.html).toBeDefined();
    });

    it("renders finished_course template", async () => {
      const variables = {
        userName: "Jan Kowalski",
        courseName: "BHP 2025",
        progressLink: "https://app.test.com/admin/courses/c1/progress",
      };

      const result = await service.render("finished_course", variables, tenantId, userId, "en");

      expect(result).not.toBeNull();
      expect(result!.html).toBeDefined();
    });
  });
});
