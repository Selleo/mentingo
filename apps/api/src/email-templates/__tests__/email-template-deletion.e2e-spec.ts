import { NotFoundException } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { v4 as uuidV4, v5 as uuidV5 } from "uuid";

import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { tenants } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { ensureTenant } from "../../../test/helpers/tenant-helpers";
import { EmailTemplateRepository } from "../repositories/email-template.repository";
import { EmailTemplateExampleService } from "../services/email-template-example.service";
import { EmailTemplateService } from "../services/email-template.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Email template deletion (e2e)", () => {
  let app: INestApplication;
  let service: EmailTemplateService;
  let repository: EmailTemplateRepository;
  let runner: TenantDbRunnerService;
  let tenantId: string;

  beforeAll(async () => {
    ({ app } = await createE2ETest({ useDbProxy: true }));
    service = app.get(EmailTemplateService);
    repository = app.get(EmailTemplateRepository);
    runner = app.get(TenantDbRunnerService);
    tenantId = await ensureTenant(app.get(DB_ADMIN));
  });
  afterAll(async () => {
    await app?.close();
  });

  it("removes a published override from delivery and prevents reading or restoring it", async () => {
    await runner.runWithTenant(tenantId, async () => {
      const template = await service.copyDefaultEmailTemplate(EMAIL_TEMPLATE_EVENTS.WELCOME);
      await service.publishEmailTemplate(template.id!);
      await service.deleteEmailTemplate(template.id!);
      expect(await repository.findPublishedEmailTemplate(template.event)).toBeUndefined();
      await expect(service.getEmailTemplate(template.id!)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.restoreEmailTemplate(template.id!)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      await expect(service.deleteEmailTemplate(template.id!)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      const list = await service.getEmailTemplates(1, 100);
      expect(list.data.some(({ id }) => id === template.id)).toBe(false);
      expect(
        list.data.some(({ event, source }) => event === template.event && source === "default"),
      ).toBe(true);
    });
  });

  it("does not allow another tenant to delete the template", async () => {
    const db = app.get<DatabasePg>(DB_ADMIN);
    const [otherTenant] = await db
      .insert(tenants)
      .values({
        name: "Other email template tenant",
        host: `https://email-template-${uuidV4()}.local`,
      })
      .returning();
    const template = await runner.runWithTenant(tenantId, () =>
      service.copyDefaultEmailTemplate(EMAIL_TEMPLATE_EVENTS.WELCOME),
    );
    await expect(
      runner.runWithTenant(otherTenant.id, () => service.deleteEmailTemplate(template.id!)),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      runner.runWithTenant(tenantId, () => service.getEmailTemplate(template.id!)),
    ).resolves.toMatchObject({ id: template.id });
  });

  it("does not recreate a deleted example when startup provisioning runs again", async () => {
    const examples = app.get(EmailTemplateExampleService);
    await examples.ensureExampleEmailTemplate(tenantId);
    const exampleId = uuidV5("email-template-example", tenantId);
    await runner.runWithTenant(tenantId, () => service.deleteEmailTemplate(exampleId));
    await examples.ensureExampleEmailTemplate(tenantId);
    await expect(
      runner.runWithTenant(tenantId, () => service.getEmailTemplate(exampleId)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
