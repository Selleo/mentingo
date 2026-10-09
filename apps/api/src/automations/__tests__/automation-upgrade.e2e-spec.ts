import {
  EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT,
  getBuiltInTemplatePublication,
} from "@repo/email-templates";
import { eq } from "drizzle-orm";

import { DefaultAutomationSetupService } from "src/automation-execution/services/default-automation-setup.service";
import { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import { automations, emailTemplates } from "src/storage/schema";

import { AutomationValidationAndSimulationService } from "../services/automation-validation-and-simulation.service";

import { getFirstEmailStep, setupAutomationTestContext } from "./automation-test.helpers";

import type { AutomationTestContext } from "./automation-test.helpers";
import type { AutomationWorkflowTemplateResponse } from "../schema/automation.schema";

describe("Automation upgrade compatibility (e2e)", () => {
  let t: AutomationTestContext;

  beforeAll(async () => {
    t = await setupAutomationTestContext();
  });
  beforeEach(async () => {
    await t.resetAutomationTestState();
  });
  afterAll(async () => {
    await t?.closeAutomationTestContext();
  });

  it.each(["welcome", "admin_overdue_courses"] as const)(
    "preserves a legacy published %s override before provisioning and on repeated startup",
    async (event) => {
      await t.runAsTenant(t.defaultTenantId, async () => {
        await t.db.delete(automations);
        const legacy = EMAIL_TEMPLATE_DEFINITIONS_BY_EVENT[event];
        const [template] = await t.db
          .insert(emailTemplates)
          .values({
            tenantId: t.defaultTenantId,
            event,
            name: { en: "Existing custom notification" },
            subject: { en: "Existing custom subject" },
            content: { en: legacy.defaultDocuments.en! },
            baseLanguage: "en",
            availableLocales: ["en"],
            status: "published",
            publishedAt: "2026-01-01T00:00:00.000Z",
          })
          .returning();
        const setup = t.app.get(DefaultAutomationSetupService);
        await setup.ensureTenantDefaultAutomations();
        const [migrated] = await t.db
          .select()
          .from(emailTemplates)
          .where(eq(emailTemplates.id, template.id));
        expect(migrated).toMatchObject({
          subject: template.subject,
          content: template.content,
          publishedAt: template.publishedAt,
          publicationVersion: 1,
          triggerEventKind: event,
          publication: { subject: template.subject, content: template.content },
        });
        expect(migrated.placeholders.length).toBeGreaterThan(0);
        const [defaultAutomation] = await t.db
          .select()
          .from(automations)
          .where(eq(automations.builtInKey, event));
        const record = await t.getAutomation(defaultAutomation.id);
        await expect(
          t.app
            .get(AutomationValidationAndSimulationService)
            .collectAutomationReadinessIssues(record.workflow),
        ).resolves.toEqual([]);
        const email = getFirstEmailStep(record);
        expect(email.config.template).toEqual({ type: "custom", id: template.id });
        if (event === "admin_overdue_courses") {
          expect(email.config.mappings?.courses).toEqual({
            type: "event_field",
            field: "overdue_courses_summary",
          });
        }
        const rendered = await t.app.get(EmailTemplateRenderingService).renderMappedEmailTemplate(
          t.defaultTenantId,
          { type: "custom", id: template.id },
          "en",
          {
            courses_link: "https://academy.example/courses",
            courses: "Preserved overdue summary",
          },
          { companyName: "Academy", primaryColor: "#123456" },
        );
        expect(rendered.subject).toBe("Existing custom subject");
        expect(rendered.html).toContain("https://academy.example/courses");
        if (event === "admin_overdue_courses")
          expect(rendered.html).toContain("Preserved overdue summary");

        await setup.ensureTenantDefaultAutomations();
        expect(
          (await t.db.select().from(emailTemplates).where(eq(emailTemplates.id, template.id)))[0],
        ).toEqual(migrated);
        expect(await t.getAutomation(defaultAutomation.id)).toEqual(record);
      });
    },
  );

  it("applies and enables an account email with an unfinished secondary translation", async () => {
    const publication = getBuiltInTemplatePublication("password_recovery");
    const template = await t.createEmailTemplate({
      name: publication.name,
      placeholders: publication.placeholders,
      baseLanguage: publication.baseLanguage,
      subject: { en: publication.subject.en!, pl: "" },
      content: { en: publication.content.en!, pl: { type: "doc", version: 1, content: [] } },
    });
    await t.requestEmailTemplateApi("post", `/${template.id}/publish`).expect(201);
    const catalog = (await t.requestAutomationApi("get", "/workflow-templates").expect(200)).body
      .data as AutomationWorkflowTemplateResponse[];
    const definition = catalog.find(({ key }) => key === "password_recovery")!.definition;
    getFirstEmailStep(definition).config.template = { type: "custom", id: template.id! };
    const automation = await t.createAutomation(definition);
    await t.requestAutomationApi("post", `/${automation.id}/apply`).expect(201);
    await t.requestAutomationApi("post", `/${automation.id}/enable`).expect(201);
  });
});
