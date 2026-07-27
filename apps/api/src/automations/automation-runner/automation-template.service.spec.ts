import { Test } from "@nestjs/testing";

import { AutomationTemplateService } from "./automation-template.service";

import type { TestingModule } from "@nestjs/testing";
import type { UUIDType } from "src/common";

describe("AutomationTemplateService", () => {
  let service: AutomationTemplateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AutomationTemplateService],
    }).compile();

    service = module.get(AutomationTemplateService);
  });

  describe("getTemplate", () => {
    it("returns a template with the requested id", async () => {
      const templateId = "template-123" as UUIDType;
      const result = await service.getTemplate(templateId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(templateId);
    });

    it("returns a template with subject and body containing placeholders", async () => {
      const templateId = "template-456" as UUIDType;
      const result = await service.getTemplate(templateId);

      expect(result!.subject).toContain("{{recipient_name}}");
      expect(result!.body).toContain("{{recipient_name}}");
      expect(result!.body).toContain("{{course_title}}");
      expect(result!.body).toContain("{{link}}");
    });

    // TODO: Once email templates are stored in DB, add tests for:
    // - Template not found returns null
    // - Template isolation per tenant
    // - Template content validation
  });
});
