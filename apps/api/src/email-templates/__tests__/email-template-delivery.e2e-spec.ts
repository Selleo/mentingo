import { randomUUID } from "node:crypto";

import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_EVENTS,
  getEmailTemplateDefinition,
} from "@repo/email-templates";
import { COURSE_ENROLLMENT, SUPPORTED_LANGUAGES } from "@repo/shared";
import { isNull } from "drizzle-orm";
import request from "supertest";

import { ResetPasswordService } from "src/auth/reset-password.service";
import { EmailService } from "src/common/emails/emails.service";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { DEFAULT_EMAIL_TRIGGERS } from "src/settings/constants/settings.constants";
import { resources, settings, studentCourses } from "src/storage/schema";
import { NotifyUsersHandler } from "src/user/handlers/notify-users.handler";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createCourseFactory } from "../../../test/factory/course.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { EmailTemplateValidationService } from "../services/email-template-validation.service";

import {
  draftBody,
  previewBody,
  setupEmailTemplateTest,
  textDocument,
  welcome,
} from "./email-template-test.helpers";

import type { EmailTemplateTestContext } from "./email-template-test.helpers";
import type { PreviewEmailTemplateBody } from "../schemas/email-template.schema";
import type { EmailTemplateDefinition } from "@repo/email-templates";

const recovery = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY);

// Subscribe before submitting: completed jobs are removed immediately by the worker.
async function enqueueAndWait(
  t: EmailTemplateTestContext,
  body: PreviewEmailTemplateBody,
  otherTenant = false,
) {
  const events = t.app.get(QueueService).getQueueEvents(QUEUE_NAMES.EMAIL_TEMPLATE_TEST);
  await events.waitUntilReady();
  const outcomes = new Map<string, { status: "completed" | "failed"; reason?: string }>();
  let notify = () => {};
  const completed = ({ jobId }: { jobId: string }) => {
    outcomes.set(jobId, { status: "completed" });
    notify();
  };
  const failed = ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
    outcomes.set(jobId, { status: "failed", reason: failedReason });
    notify();
  };
  events.on("completed", completed);
  events.on("failed", failed);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const req = otherTenant
      ? t.http("post", "/test-send", t.otherCookie, t.otherTenant.host)
      : t.http("post", "/test-send");
    const response = await req.send(body).expect(201);
    const { jobId } = response.body.data;
    expect(typeof jobId).toBe("string");
    const result = await new Promise<{ status: "completed" | "failed"; reason?: string }>(
      (resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error(`Email test job ${jobId} did not settle within 15 seconds`)),
          15000,
        );
        notify = () => {
          const outcome = outcomes.get(jobId);
          if (outcome) resolve(outcome);
        };
        notify();
      },
    );
    return { jobId, ...result };
  } finally {
    clearTimeout(timeout);
    events.off("completed", completed);
    events.off("failed", failed);
  }
}

describe("Email template delivery integration (e2e)", () => {
  let t: EmailTemplateTestContext;
  let emails: EmailService;
  let validation: EmailTemplateValidationService;
  beforeAll(async () => {
    t = await setupEmailTemplateTest({ worker: true });
    emails = t.app.get(EmailService);
    validation = t.app.get(EmailTemplateValidationService);
  });
  beforeEach(async () => {
    await t.reset();
  });
  afterAll(async () => {
    await t?.app.close();
    jest.restoreAllMocks();
  });

  const send = (definition: EmailTemplateDefinition = welcome, tenantId?: string) =>
    emails.sendEmailWithLogo(
      {
        to: t.student.email,
        subject: "Original default subject",
        text: "Original default text",
        html: "<p>Original default HTML</p>",
      },
      {
        tenantId: tenantId ?? t.defaultTenantId,
        template: {
          event: definition.event,
          language: SUPPORTED_LANGUAGES.EN,
          variables: validation.getSampleVariables(definition.event),
        },
      },
    );

  it.each(EMAIL_TEMPLATE_DEFINITIONS)(
    "delivers the published $event through the real email service",
    async (definition) => {
      const body = draftBody(definition);
      body.subject.en = `Custom ${definition.event} {{ company_name }}`;
      const template = await t.create(body);
      await t.http("post", `/${template.id}/publish`).expect(201);
      const branding = await emails.getDefaultEmailProperties(t.defaultTenantId);
      await send(definition);
      const [email] = t.adapter.getAllEmails();
      expect(t.adapter.getAllEmails()).toHaveLength(1);
      expect(email).toMatchObject({
        to: t.student.email,
        subject: `Custom ${definition.event} ${branding.companyName}`,
        from: expect.any(String),
      });
      expect(email.html).toContain("cid:logo");
      expect(email.html).not.toContain("Original default HTML");
      expect(email.html).not.toContain("{{");
      expect(email.text?.trim()).not.toBe("");
      expect(email.attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filename: "logo.png", content: t.png }),
          expect.objectContaining({ filename: "border-circle.png", content: t.png }),
        ]),
      );
    },
  );

  it("switches delivery with publish, archive, restore, republish and delete", async () => {
    const template = await t.create({ ...draftBody(), subject: { en: "Published custom" } });
    const assertSubject = async (subject: string) => {
      t.adapter.clearEmails();
      await send();
      expect(t.adapter.getAllEmails()).toHaveLength(1);
      expect(t.adapter.getLastEmail()?.subject).toBe(subject);
    };
    await assertSubject("Original default subject");
    await t.http("post", `/${template.id}/publish`).expect(201);
    await assertSubject("Published custom");
    await t.http("post", `/${template.id}/archive`).expect(201);
    await assertSubject("Original default subject");
    await t.http("post", `/${template.id}/restore`).expect(201);
    await assertSubject("Original default subject");
    await t.http("post", `/${template.id}/publish`).expect(201);
    await assertSubject("Published custom");
    await t.http("delete", `/${template.id}`).expect(200);
    await assertSubject("Original default subject");
  });

  it("uses the recipient translation or falls back the whole email while escaping real values", async () => {
    const body = draftBody(recovery);
    body.subject = { en: "Reset {{ name }}", pl: "Polski {{ name }}" };
    body.content = { en: body.content.en };
    const template = await t.create(body);
    await t.http("post", `/${template.id}/publish`).expect(201);
    const options = {
      tenantId: t.defaultTenantId,
      template: {
        event: recovery.event,
        language: SUPPORTED_LANGUAGES.PL,
        variables: {
          name: "Real <script>",
          reset_link: "https://tenant.example/reset?token=fixture",
        },
      },
    };
    const original = { to: t.student.email, subject: "Default", text: "Default" };
    await emails.sendEmailWithLogo(original, options);
    expect(t.adapter.getLastEmail()).toMatchObject({ subject: "Reset Real <script>" });
    expect(t.adapter.getLastEmail()?.html).toContain("Real &lt;script&gt;");
    expect(t.adapter.getLastEmail()?.html).toContain(options.template.variables.reset_link);
    expect(t.adapter.getLastEmail()?.html).not.toContain("<script>");
    await t
      .http("patch", `/${template.id}`)
      .send({ content: { pl: recovery.defaultDocuments.pl } })
      .expect(200);
    await emails.sendEmailWithLogo(original, options);
    expect(t.adapter.getLastEmail()?.subject).toBe("Polski Real <script>");
  });

  it("does not use another tenant's published override or branding", async () => {
    await t.runAsTenant(t.defaultTenantId, () =>
      t.db
        .update(settings)
        .set({
          settings: settingsToJSONBuildObject({
            ...DEFAULT_E2E_GLOBAL_SETTINGS,
            companyInformation: { companyName: "Tenant Alpha" },
          }),
        })
        .where(isNull(settings.userId)),
    );
    await t.runAsTenant(t.otherTenant.id, () =>
      t.db
        .update(settings)
        .set({
          settings: settingsToJSONBuildObject({
            ...DEFAULT_E2E_GLOBAL_SETTINGS,
            companyInformation: { companyName: "Tenant Beta" },
          }),
        })
        .where(isNull(settings.userId)),
    );
    const template = await t.create({
      ...draftBody(),
      subject: { en: "Custom {{ company_name }}" },
    });
    await t.http("post", `/${template.id}/publish`).expect(201);
    await send();
    expect(t.adapter.getLastEmail()?.subject).toBe("Custom Tenant Alpha");
    await send(welcome, t.otherTenant.id);
    expect(t.adapter.getLastEmail()?.subject).toBe("Original default subject");
    const other = (
      await t
        .http("post", "", t.otherCookie, t.otherTenant.host)
        .send({ ...draftBody(), subject: { en: "Custom {{ company_name }}" } })
        .expect(201)
    ).body.data;
    await t.http("post", `/${other.id}/publish`, t.otherCookie, t.otherTenant.host).expect(201);
    await send(welcome, t.otherTenant.id);
    expect(t.adapter.getLastEmail()?.subject).toBe("Custom Tenant Beta");
  });

  it("preserves existing attachments and deduplicates uploaded CID images", async () => {
    const asset = (await t.http("post", "/images").attach("file", t.png, "image.png").expect(201))
      .body.data;
    const body = draftBody();
    body.content.en!.content.push(
      ...["First", "Second"].map((alt) => ({
        type: "image" as const,
        attrs: { src: asset.src, alt },
      })),
    );
    const template = await t.create(body);
    await t.http("post", `/${template.id}/publish`).expect(201);
    const attachment = {
      filename: "certificate.pdf",
      content: Buffer.from("fixture attachment"),
      contentType: "application/pdf",
    };
    await emails.sendEmailWithLogo(
      { to: t.student.email, subject: "Original", text: "Original", attachments: [attachment] },
      {
        tenantId: t.defaultTenantId,
        template: {
          event: welcome.event,
          language: SUPPORTED_LANGUAGES.EN,
          variables: validation.getSampleVariables(welcome.event),
        },
      },
    );
    const email = t.adapter.getLastEmail()!;
    expect(email.attachments).toContainEqual(attachment);
    expect(
      email.attachments?.filter(({ cid }) => cid === `email-template-${asset.resourceId}`),
    ).toHaveLength(1);
    expect(
      email.html?.match(new RegExp(`cid:email-template-${asset.resourceId}`, "g")),
    ).toHaveLength(2);
    expect(email.html).not.toContain("https://storage.example");
  });

  it.each<{ name: string; variables: Record<string, string>; error: string }>([
    {
      name: "missing authentication value",
      variables: { name: "Real user" },
      error: "emailTemplates.errors.missingMandatoryVariables",
    },
    {
      name: "unsafe real URL",
      variables: { name: "Real user", reset_link: "javascript:alert(1)" },
      error: "emailTemplates.errors.httpsRequired",
    },
  ])("fails delivery for $name without silently sending defaults", async ({ variables, error }) => {
    const template = await t.create(draftBody(recovery));
    await t.http("post", `/${template.id}/publish`).expect(201);
    await expect(
      emails.sendEmailWithLogo(
        { to: t.student.email, subject: "Default", text: "Default" },
        {
          tenantId: t.defaultTenantId,
          template: { event: recovery.event, language: SUPPORTED_LANGUAGES.EN, variables },
        },
      ),
    ).rejects.toThrow(error);
    expect(t.adapter.getAllEmails()).toEqual([]);
  });

  it("delivers password recovery from its real HTTP trigger with a usable reset token", async () => {
    const template = await t.create({
      ...draftBody(recovery),
      subject: { en: "Reset for {{ name }}" },
    });
    await t.http("post", `/${template.id}/publish`).expect(201);
    await request(t.app.getHttpServer())
      .post("/api/auth/forgot-password")
      .send({ email: t.student.email })
      .expect(201);
    const email = t.adapter.getLastEmail()!;
    expect(t.adapter.getAllEmails()).toHaveLength(1);
    expect(email).toMatchObject({
      to: t.student.email,
      subject: `Reset for ${t.student.firstName}`,
    });
    const resetUrl = email.html?.match(/href="([^"]*create-new-password[^\"]*)"/)?.[1];
    expect(resetUrl).toBeDefined();
    const url = new URL(resetUrl!.replace(/&amp;/g, "&"));
    expect(url.origin).toBe("https://tenant.local");
    const token = url.searchParams.get("resetToken")!;
    expect(token).toBeTruthy();
    const stored = await t.runAsTenant(t.defaultTenantId, () =>
      t.app.get(ResetPasswordService).getOneByToken(token),
    );
    expect(stored.userId).toBe(t.student.id);
  });

  it("delivers real course-assignment data and respects disabled triggers", async () => {
    const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.USER_ASSIGNED_TO_COURSE);
    const template = await t.create({
      ...draftBody(definition),
      subject: { en: "Assigned {{ course_name }}" },
    });
    await t.http("post", `/${template.id}/publish`).expect(201);
    await t.runAsTenant(t.defaultTenantId, async () => {
      const course = await createCourseFactory(t.db).create({
        authorId: t.admin.id,
        title: "Real assigned course",
        thumbnailS3Key: null,
      });
      await t.db.insert(studentCourses).values({
        studentId: t.student.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
      });
      const trigger = new UsersAssignedToCourseEvent({
        courseId: course.id,
        studentIds: [t.student.id],
      });
      await t.db
        .update(settings)
        .set({
          settings: settingsToJSONBuildObject({
            ...DEFAULT_E2E_GLOBAL_SETTINGS,
            userEmailTriggers: { ...DEFAULT_EMAIL_TRIGGERS, userCourseAssignment: true },
          }),
        })
        .where(isNull(settings.userId));
      await t.app.get(NotifyUsersHandler).handle(trigger);
      const email = t.adapter.getLastEmail()!;
      expect(t.adapter.getAllEmails()).toHaveLength(1);
      expect(email).toMatchObject({
        to: t.student.email,
        subject: "Assigned Real assigned course",
      });
      expect(email.html).toContain(`https://tenant.local/course/${course.id}`);
      t.adapter.clearEmails();
      await t.db
        .update(settings)
        .set({
          settings: settingsToJSONBuildObject(DEFAULT_E2E_GLOBAL_SETTINGS),
        })
        .where(isNull(settings.userId));
      await t.app.get(NotifyUsersHandler).handle(trigger);
      expect(t.adapter.getAllEmails()).toEqual([]);
    });
  });

  it("queues unsaved content for the authenticated actor and bypasses published overrides", async () => {
    const template = await t.create({ ...draftBody(), subject: { en: "Published override" } });
    await t.http("post", `/${template.id}/publish`).expect(201);
    const enqueue = jest.spyOn(t.app.get(QueueService), "enqueue");
    const body = { ...previewBody(), subject: { en: "Unsaved test subject" } };
    expect((await enqueueAndWait(t, body)).status).toBe("completed");
    expect(enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.EMAIL_TEMPLATE_TEST,
      QUEUE_NAMES.EMAIL_TEMPLATE_TEST,
      { tenantId: t.defaultTenantId, userId: t.admin.id, recipient: t.admin.email, body },
      expect.objectContaining({ attempts: 3, backoff: { type: "exponential", delay: 1000 } }),
    );
    expect(t.adapter.getAllEmails()).toHaveLength(1);
    expect(t.adapter.getLastEmail()).toMatchObject({
      to: t.admin.email,
      subject: "Unsaved test subject",
    });
    expect((await t.get(template.id!)).subject.en).toBe("Published override");
  });

  it("runs test-send in the submitting tenant and attaches its private image", async () => {
    const asset = (
      await t
        .http("post", "/images", t.otherCookie, t.otherTenant.host)
        .attach("file", t.png, "image.png")
        .expect(201)
    ).body.data;
    const body = previewBody();
    body.content.en!.content.push({
      type: "image",
      attrs: { src: asset.src, alt: "Other tenant image" },
    });
    expect((await enqueueAndWait(t, body, true)).status).toBe("completed");
    expect(t.adapter.getLastEmail()).toMatchObject({ to: t.otherAdmin.email });
    expect(t.adapter.getLastEmail()?.attachments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cid: `email-template-${asset.resourceId}` }),
      ]),
    );
  });

  it("retries a transient delivery failure and captures one successful email", async () => {
    const adapter = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValueOnce(new Error("Transient test transport failure"));
    try {
      expect((await enqueueAndWait(t, previewBody())).status).toBe("completed");
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(t.adapter.getAllEmails()).toHaveLength(1);
    } finally {
      adapter.mockRestore();
    }
  });

  it("exhausts failed deliveries without capturing an email", async () => {
    const adapter = jest
      .spyOn(t.adapter, "sendMail")
      .mockRejectedValue(new Error("Test transport unavailable"));
    try {
      expect(await enqueueAndWait(t, previewBody())).toMatchObject({
        status: "failed",
        reason: "Test transport unavailable",
      });
      expect(adapter).toHaveBeenCalledTimes(3);
      expect(t.adapter.getAllEmails()).toEqual([]);
    } finally {
      adapter.mockRestore();
    }
  });

  it.each(["missing", "foreign"])(
    "accepts a job but fails %s assets in the worker",
    async (kind) => {
      const id = randomUUID();
      if (kind === "foreign")
        await t.runAsTenant(t.otherTenant.id, () =>
          t.db.insert(resources).values({
            id,
            reference: `${t.otherTenant.id}/email-templates/image`,
            contentType: "image/png",
          }),
        );
      const body = previewBody();
      body.content.en!.content.push({
        type: "image",
        attrs: { src: `asset:${id}`, alt: "Unavailable" },
      });
      expect(await enqueueAndWait(t, body)).toMatchObject({
        status: "failed",
        reason: "files.toast.invalidData",
      });
      expect(t.adapter.getAllEmails()).toEqual([]);
      expect(t.read).not.toHaveBeenCalled();
    },
  );

  it("rejects missing authentication actions before queueing test mail", async () => {
    const enqueue = jest.spyOn(t.app.get(QueueService), "enqueue");
    const response = await t
      .http("post", "/test-send")
      .send({ ...previewBody(recovery), content: { en: textDocument() } })
      .expect(400);
    expect(response.body.message).toBe("emailTemplates.errors.missingMandatoryVariables");
    expect(enqueue).not.toHaveBeenCalled();
  });
});
