import { randomUUID } from "node:crypto";

import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_EVENTS,
  getEmailTemplateDefinition,
  buildOverdueCoursesEventFields,
} from "@repo/email-templates";
import {
  type AutomationTemplateReference,
  type AutomationPlaceholderValue,
  type SupportedLanguages,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { EmailService } from "src/common/emails/emails.service";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { resources } from "src/storage/schema";

import { EmailTemplateRenderingService } from "../services/email-template-rendering.service";
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
import type { Attachment } from "src/common/emails/email.interface";

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

  const renderer = () => t.app.get(EmailTemplateRenderingService);
  const send = async (
    reference: AutomationTemplateReference,
    definition: EmailTemplateDefinition = welcome,
    tenantId = t.defaultTenantId,
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
    values?: Record<string, AutomationPlaceholderValue>,
    attachments: Attachment[] = [],
  ) => {
    const branding = await emails.getDefaultEmailProperties(tenantId);
    const samples = validation.buildEmailPreviewVariables(draftBody(definition).placeholders!);
    const fields = {
      ...samples,
      ...values,
    } as Record<string, AutomationPlaceholderValue>;
    if (definition.event === "admin_overdue_courses")
      Object.assign(
        fields,
        buildOverdueCoursesEventFields(
          Object.fromEntries(
            Object.values(SUPPORTED_LANGUAGES).map((locale) => [locale, samples.courses]),
          ) as Parameters<typeof buildOverdueCoursesEventFields>[0],
        ),
      );
    const result = await renderer().renderMappedEmailTemplate(
      tenantId,
      reference,
      language,
      fields,
      {
        ...branding,
        logoUrl: "cid:logo",
        borderCircleUrl: "cid:border-circle",
      },
    );
    await emails.sendEmailWithLogo(
      { to: t.student.email, ...result, attachments: [...attachments, ...result.attachments] },
      { tenantId },
    );
  };

  it.each(EMAIL_TEMPLATE_DEFINITIONS)(
    "delivers explicitly selected published $event content through shared transport",
    async (definition) => {
      const body = draftBody(definition);
      body.subject.en = `Custom ${definition.event} {{ company_name }}`;
      const template = await t.create(body);
      await t.http("post", `/${template.id}/publish`).expect(201);
      await send({ type: "custom", id: template.id! }, definition);
      const branding = await emails.getDefaultEmailProperties(t.defaultTenantId);
      const email = t.adapter.getLastEmail()!;
      expect(email.subject).toBe(`Custom ${definition.event} ${branding.companyName}`);
      expect(email.html).toContain("cid:logo");
      expect(email.html).not.toContain("{{");
      expect(email.attachments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ filename: "logo.png", content: t.png }),
          expect.objectContaining({ filename: "border-circle.png", content: t.png }),
        ]),
      );
    },
  );
  it("keeps draft edits separate and makes archived/restored/deleted resources unavailable until published", async () => {
    const template = await t.create({ ...draftBody(), subject: { en: "Published custom" } });
    const reference: AutomationTemplateReference = { type: "custom", id: template.id! };
    await expect(
      t.runAsTenant(t.defaultTenantId, () => renderer().getPublishedEmailTemplate(reference)),
    ).rejects.toThrow("emailTemplates.errors.notPublished");
    await t.http("post", `/${template.id}/publish`).expect(201);
    await t
      .http("patch", `/${template.id}`)
      .send({ subject: { en: "Unsaved draft" } })
      .expect(200);
    await send(reference);
    expect(t.adapter.getLastEmail()?.subject).toBe("Published custom");
    await t.http("post", `/${template.id}/publish`).expect(201);
    await send(reference);
    expect(t.adapter.getLastEmail()?.subject).toBe("Unsaved draft");
    for (const transition of ["archive", "restore"]) {
      await t.http("post", `/${template.id}/${transition}`).expect(201);
      await expect(
        t.runAsTenant(t.defaultTenantId, () => renderer().getPublishedEmailTemplate(reference)),
      ).rejects.toThrow("emailTemplates.errors.notPublished");
    }
    await t.http("post", `/${template.id}/publish`).expect(201);
    await t.http("delete", `/${template.id}`).expect(200);
    await expect(
      t.runAsTenant(t.defaultTenantId, () => renderer().getPublishedEmailTemplate(reference)),
    ).rejects.toThrow("emailTemplates.errors.notPublished");
  });
  it("falls back the whole publication and switches language only after republishing", async () => {
    const body = draftBody(recovery);
    body.subject = { en: "Reset {{ name }}", pl: "Polski {{ name }}" };
    body.content = { en: body.content.en };
    const template = await t.create(body);
    await t.http("post", `/${template.id}/publish`).expect(201);
    const reference: AutomationTemplateReference = { type: "custom", id: template.id! };
    const values = { name: "Real <script>", reset_link: "https://tenant.example/reset" };
    await send(reference, recovery, t.defaultTenantId, "pl", values);
    expect(t.adapter.getLastEmail()?.subject).toBe("Reset Real <script>");
    expect(t.adapter.getLastEmail()?.html).toContain("Real &lt;script&gt;");
    await t
      .http("patch", `/${template.id}`)
      .send({ content: { pl: recovery.defaultDocuments.pl } })
      .expect(200);
    await send(reference, recovery, t.defaultTenantId, "pl", values);
    expect(t.adapter.getLastEmail()?.subject).toBe("Reset Real <script>");
    await t.http("post", `/${template.id}/publish`).expect(201);
    await send(reference, recovery, t.defaultTenantId, "pl", values);
    expect(t.adapter.getLastEmail()?.subject).toBe("Polski Real <script>");
  });
  it("rejects another tenant's custom reference without sending fallback content", async () => {
    const template = await t.create(draftBody());
    await t.http("post", `/${template.id}/publish`).expect(201);
    await expect(
      send({ type: "custom", id: template.id! }, welcome, t.otherTenant.id),
    ).rejects.toThrow("emailTemplates.errors.notPublished");
    expect(t.adapter.getAllEmails()).toEqual([]);
  });
  it("retains explicit attachments and deduplicates uploaded CID assets", async () => {
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
    const attachment = { filename: "certificate.pdf", content: Buffer.from("fixture attachment") };
    await send({ type: "custom", id: template.id! }, welcome, t.defaultTenantId, "en", undefined, [
      attachment,
    ]);
    const email = t.adapter.getLastEmail()!;
    expect(email.attachments).toContainEqual(attachment);
    expect(
      email.attachments?.filter((item) => item.cid === `email-template-${asset.resourceId}`),
    ).toHaveLength(1);
    expect(
      email.html?.match(new RegExp(`cid:email-template-${asset.resourceId}`, "g")),
    ).toHaveLength(2);
  });
  it("rejects invalid mapped values before transport", async () => {
    const template = await t.create(draftBody(recovery));
    await t.http("post", `/${template.id}/publish`).expect(201);
    await expect(
      send({ type: "custom", id: template.id! }, recovery, t.defaultTenantId, "en", {
        name: "Alex",
        reset_link: "javascript:alert(1)",
      }),
    ).rejects.toThrow("emailTemplates.errors.httpsRequired");
    expect(t.adapter.getAllEmails()).toEqual([]);
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

  it("queues event-independent draft content without inferring source sensitivity", async () => {
    const body = { ...previewBody(recovery), content: { en: textDocument() } };
    expect((await enqueueAndWait(t, body)).status).toBe("completed");
    expect(t.adapter.getLastEmail()?.to).toBe(t.admin.email);
  });
});
