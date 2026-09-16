import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { ensureTenant } from "../../../test/helpers/tenant-helpers";
import { EmailTemplateService } from "../services/email-template.service";

import type { INestApplication } from "@nestjs/common";
import type { EmailTemplateDocument } from "@repo/email-templates";

describe("Email template translation updates (e2e)", () => {
  let app: INestApplication;
  let service: EmailTemplateService;
  let runner: TenantDbRunnerService;
  let tenantId: string;

  beforeAll(async () => {
    ({ app } = await createE2ETest({ useDbProxy: true }));
    service = app.get(EmailTemplateService);
    runner = app.get(TenantDbRunnerService);
    tenantId = await ensureTenant(app.get(DB_ADMIN));
  });

  afterAll(async () => {
    await app?.close();
  });

  it("preserves independent concurrent name, subject and document edits", async () => {
    const template = await runner.runWithTenant(tenantId, () =>
      service.copyDefaultEmailTemplate(EMAIL_TEMPLATE_EVENTS.WELCOME),
    );
    const document = (text: string): EmailTemplateDocument => ({
      type: "doc",
      version: 1,
      content: [
        {
          type: "text",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        },
      ],
    });
    const enContent = document("English body");
    const plContent = document("Polska treść");
    await Promise.all([
      runner.runWithTenant(tenantId, () =>
        service.updateEmailTemplate(template.id!, {
          name: { [SUPPORTED_LANGUAGES.EN]: "English name" },
          subject: { [SUPPORTED_LANGUAGES.EN]: "English subject" },
          content: { [SUPPORTED_LANGUAGES.EN]: enContent },
        }),
      ),
      runner.runWithTenant(tenantId, () =>
        service.updateEmailTemplate(template.id!, {
          name: { [SUPPORTED_LANGUAGES.PL]: "Polska nazwa" },
          subject: { [SUPPORTED_LANGUAGES.PL]: "Polski temat" },
          content: { [SUPPORTED_LANGUAGES.PL]: plContent },
        }),
      ),
    ]);
    const stored = await runner.runWithTenant(tenantId, () =>
      service.getEmailTemplate(template.id!),
    );
    expect(stored.name).toEqual({ ...template.name, en: "English name", pl: "Polska nazwa" });
    expect(stored.subject).toEqual({
      ...template.subject,
      en: "English subject",
      pl: "Polski temat",
    });
    expect(stored.content).toEqual({ ...template.content, en: enContent, pl: plContent });

    // Clearing a draft field is a locale update, not deletion of the other translations.
    const cleared = await runner.runWithTenant(tenantId, () =>
      service.updateEmailTemplate(template.id!, { subject: { [SUPPORTED_LANGUAGES.EN]: "" } }),
    );
    expect(cleared.subject.en).toBe("");
    expect(cleared.subject.pl).toBe("Polski temat");
  });
});
