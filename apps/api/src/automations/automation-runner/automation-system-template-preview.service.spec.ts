import { Test } from "@nestjs/testing";

import { AutomationSystemTemplatePreviewService } from "./automation-system-template-preview.service";

import type { TestingModule } from "@nestjs/testing";

describe("AutomationSystemTemplatePreviewService", () => {
  let service: AutomationSystemTemplatePreviewService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationSystemTemplatePreviewService],
    }).compile();

    service = module.get(AutomationSystemTemplatePreviewService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("renderPreview", () => {
    it("returns null for unknown template id", async () => {
      const result = await service.renderPreview("nonexistent_template", "en");
      expect(result).toBeNull();
    });

    it("returns null for default_email template id", async () => {
      const result = await service.renderPreview("default_email", "pl");
      expect(result).toBeNull();
    });

    it("renders user_invite template with subject and html", async () => {
      const result = await service.renderPreview("user_invite", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Platform invitation");
      expect(result!.html).toBeDefined();
      expect(result!.html.length).toBeGreaterThan(0);
    });

    it("renders welcome template in Polish", async () => {
      const result = await service.renderPreview("welcome", "pl");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Witaj na platformie");
      expect(result!.html).toBeDefined();
    });

    it("renders user_first_login template", async () => {
      const result = await service.renderPreview("user_first_login", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("First login");
    });

    it("renders user_assigned_to_course template", async () => {
      const result = await service.renderPreview("user_assigned_to_course", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Course assignment");
    });

    it("renders user_short_inactivity template", async () => {
      const result = await service.renderPreview("user_short_inactivity", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Course reminder");
    });

    it("renders user_long_inactivity template", async () => {
      const result = await service.renderPreview("user_long_inactivity", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("We miss you");
    });

    it("renders user_finished_chapter template", async () => {
      const result = await service.renderPreview("user_finished_chapter", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Chapter completed");
    });

    it("renders user_finished_course template", async () => {
      const result = await service.renderPreview("user_finished_course", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Congratulations! Course completed");
    });

    it("renders create_password_reminder template", async () => {
      const result = await service.renderPreview("create_password_reminder", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Create your password");
    });

    it("renders certificate_expiration_warning template", async () => {
      const result = await service.renderPreview("certificate_expiration_warning", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Certificate expiring soon");
    });

    it("renders certificate_expired template", async () => {
      const result = await service.renderPreview("certificate_expired", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Certificate expired");
    });

    it("renders announcement template", async () => {
      const result = await service.renderPreview("announcement", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("New training available");
    });

    it("renders course_due_date_reminder template", async () => {
      const result = await service.renderPreview("course_due_date_reminder", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Course deadline approaching");
    });

    it("renders new_user template", async () => {
      const result = await service.renderPreview("new_user", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("New user registered");
    });

    it("renders finished_course template", async () => {
      const result = await service.renderPreview("finished_course", "en");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("User completed course");
    });

    it("replaces cid:logo references in rendered html", async () => {
      const result = await service.renderPreview("welcome", "en");

      expect(result).not.toBeNull();
      expect(result!.html).not.toContain("cid:logo");
    });

    it("replaces cid:border-circle references in rendered html", async () => {
      const result = await service.renderPreview("welcome", "en");

      expect(result).not.toBeNull();
      expect(result!.html).not.toContain("cid:border-circle");
    });

    it("uses Polish as default language", async () => {
      const result = await service.renderPreview("user_invite");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Zaproszenie do platformy");
    });

    it("falls back to English sample data for unsupported language", async () => {
      const result = await service.renderPreview("user_invite", "fr" as any);

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Platform invitation");
    });

    it("renders German localization correctly", async () => {
      const result = await service.renderPreview("welcome", "de");

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Willkommen auf der Plattform");
    });
  });
});
