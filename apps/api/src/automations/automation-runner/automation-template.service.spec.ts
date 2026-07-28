import { NotFoundException } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { EmailNotificationTemplatesService } from "src/email-notification-templates/email-templates.service";

import { AutomationTemplateService } from "./automation-template.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

const mockTemplate = {
  id: "template-123",
  name: "Test Template",
  subject: { en: "Hello {{recipient_name}}", pl: "" },
  blocks: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        attrs: { uuid: "uuid-1" },
        content: [{ type: "text", text: "Welcome {{recipient_name}} to {{course_title}}" }],
      },
    ],
  },
  strings: {},
  baseLanguage: "en",
  availableLocales: ["en"],
  status: "published",
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenantId: "tenant-1",
};

describe("AutomationTemplateService", () => {
  let service: AutomationTemplateService;
  let emailTemplatesService: jest.Mocked<
    Pick<EmailNotificationTemplatesService, "getTemplateById">
  >;

  beforeEach(async () => {
    emailTemplatesService = {
      getTemplateById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationTemplateService,
        {
          provide: EmailNotificationTemplatesService,
          useValue: emailTemplatesService,
        },
      ],
    }).compile();

    service = module.get(AutomationTemplateService);
  });

  describe("getTemplate", () => {
    it("returns null when template is not found", async () => {
      emailTemplatesService.getTemplateById.mockRejectedValue(
        new NotFoundException("emailTemplates.toast.notFound"),
      );

      const result = await service.getTemplate("nonexistent-id" as UUIDType);
      expect(result).toBeNull();
    });

    it("returns rendered template with subject and body", async () => {
      emailTemplatesService.getTemplateById.mockResolvedValue(mockTemplate as never);

      const result = await service.getTemplate("template-123" as UUIDType);

      expect(result).not.toBeNull();
      expect(result!.id).toBe("template-123");
      expect(result!.subject).toContain("{{recipient_name}}");
      expect(result!.body).toBeDefined();
    });

    it("uses the template baseLanguage when no language is specified", async () => {
      emailTemplatesService.getTemplateById.mockResolvedValue(mockTemplate as never);

      const result = await service.getTemplate("template-123" as UUIDType);

      expect(result).not.toBeNull();
      expect(result!.subject).toBe("Hello {{recipient_name}}");
    });
  });
});
