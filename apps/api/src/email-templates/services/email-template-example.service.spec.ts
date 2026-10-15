import { EMAIL_TEMPLATE_STATUSES } from "@repo/email-templates";

import { SampleEmailTemplateSetupService } from "./sample-email-template-setup.service";

import type { EmailTemplateRepository } from "../repositories/email-template.repository";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("SampleEmailTemplateSetupService", () => {
  it("uses a stable per-tenant identity and inserts only a draft without updating existing examples", async () => {
    const insertSampleEmailTemplateIfAbsent = jest.fn();
    const service = new SampleEmailTemplateSetupService(
      { insertSampleEmailTemplateIfAbsent } as unknown as EmailTemplateRepository,
      { runWithTenant: async (_id, callback) => callback() } as TenantDbRunnerService,
    );
    const tenantId = "00000000-0000-4000-8000-000000000001";
    await service.ensureExampleEmailTemplate(tenantId);
    await service.ensureExampleEmailTemplate(tenantId);
    await service.ensureExampleEmailTemplate("00000000-0000-4000-8000-000000000002");
    const [first, second, third] = insertSampleEmailTemplateIfAbsent.mock.calls.map(
      ([values]) => values,
    );
    expect(first).toEqual(second);
    expect(first.id).not.toEqual(third.id);
    expect(first).toMatchObject({
      tenantId,
      event: null,
      placeholders: expect.arrayContaining([
        expect.objectContaining({ name: "course_link", type: "url" }),
      ]),
      status: EMAIL_TEMPLATE_STATUSES.DRAFT,
    });
    expect(JSON.stringify(first.content)).toContain("{{ course_link }}");
  });
});
