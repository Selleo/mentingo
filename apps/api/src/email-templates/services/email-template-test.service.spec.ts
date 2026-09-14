import { EMAIL_TEMPLATE_EVENTS, getEmailTemplateDefinition } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailTemplateTestService } from "./email-template-test.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateService } from "./email-template.service";
import type { EmailService } from "src/common/emails/emails.service";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { QueueService } from "src/queue";

describe("EmailTemplateTestService", () => {
  const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY);
  const body = {
    event: definition.event,
    language: SUPPORTED_LANGUAGES.EN,
    baseLanguage: SUPPORTED_LANGUAGES.EN,
    subject: definition.subjects,
    content: definition.defaultDocuments,
  };
  const actor: CurrentUserType = {
    userId: "admin-id",
    email: "admin@example.com",
    tenantId: "tenant-id",
    roleSlugs: [],
    permissions: [],
  };
  const enqueue = jest.fn();
  const previewEmailTemplate = jest.fn();
  const renderSampleEmailTemplate = jest.fn();
  const sendEmailWithLogo = jest.fn();
  const service = new EmailTemplateTestService(
    { enqueue } as unknown as QueueService,
    { previewEmailTemplate, renderSampleEmailTemplate } as unknown as EmailTemplateService,
    { sendEmailWithLogo } as unknown as EmailService,
    new EmailTemplateValidationService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    previewEmailTemplate.mockResolvedValue({ language: SUPPORTED_LANGUAGES.EN });
    enqueue.mockResolvedValue({ id: "job-1" });
  });

  it("takes the recipient exclusively from the authenticated administrator", async () => {
    expect(
      await service.enqueueTestEmailTemplate(
        { ...body, recipient: "attacker@example.com" } as typeof body,
        actor,
      ),
    ).toEqual({ jobId: "job-1" });
    expect(enqueue.mock.calls[0][2]).toMatchObject({
      recipient: actor.email,
      tenantId: actor.tenantId,
      userId: actor.userId,
    });
    expect(sendEmailWithLogo).not.toHaveBeenCalled();
  });

  it("rejects invalid unsaved content before queueing", async () => {
    previewEmailTemplate.mockRejectedValueOnce(new Error("invalid"));
    await expect(service.enqueueTestEmailTemplate(body, actor)).rejects.toThrow("invalid");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("requires an actionable authentication link even for test emails", async () => {
    await expect(
      service.enqueueTestEmailTemplate(
        {
          ...body,
          content: {
            en: {
              ...definition.defaultDocuments.en,
              content: [
                {
                  type: "text",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "No reset link" }] },
                  ],
                },
              ],
            },
          },
        },
        actor,
      ),
    ).rejects.toThrow("emailTemplates.errors.missingMandatoryVariables");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("sends the unsaved sample rendering without resolving the published override", async () => {
    const rendered = { subject: "Unsaved", html: "<p>Test</p>", text: "Test", attachments: [] };
    renderSampleEmailTemplate.mockResolvedValueOnce(rendered);
    await service.sendTestEmailTemplate({
      body,
      tenantId: actor.tenantId,
      userId: actor.userId,
      recipient: actor.email,
    });
    expect(sendEmailWithLogo).toHaveBeenCalledWith(
      { to: actor.email, ...rendered },
      { tenantId: actor.tenantId },
    );
  });
});
