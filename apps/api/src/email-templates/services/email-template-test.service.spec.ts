import {
  EMAIL_TEMPLATE_EVENTS,
  getEmailTemplateDefinition,
  getBuiltInTemplatePublication,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailTemplateTestDeliveryService } from "./email-template-test-delivery.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateManagementService } from "./email-template-management.service";
import type { EmailService } from "src/common/emails/emails.service";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { QueueService } from "src/queue";

describe("EmailTemplateTestDeliveryService", () => {
  const definition = getEmailTemplateDefinition(EMAIL_TEMPLATE_EVENTS.PASSWORD_RECOVERY);
  const body = {
    placeholders: getBuiltInTemplatePublication("password_recovery").placeholders,
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
  const service = new EmailTemplateTestDeliveryService(
    { enqueue } as unknown as QueueService,
    {
      previewEmailTemplate,
      renderSampleEmailTemplate,
    } as unknown as EmailTemplateManagementService,
    { sendEmailWithLogo } as unknown as EmailService,
    new EmailTemplateValidationService(),
  );

  beforeEach(() => {
    jest.clearAllMocks();
    enqueue.mockResolvedValue({ id: "job-1" });
  });

  it("takes the recipient exclusively from the authenticated administrator", async () => {
    expect(
      await service.enqueueEmailTemplateTest(
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
    expect(previewEmailTemplate).not.toHaveBeenCalled();
    expect(renderSampleEmailTemplate).not.toHaveBeenCalled();
  });

  it("rejects invalid unsaved content before queueing", async () => {
    await expect(
      service.enqueueEmailTemplateTest(
        {
          ...body,
          subject: { en: "{{ unsupported_variable }}" },
        },
        actor,
      ),
    ).rejects.toThrow("emailTemplates.errors.unsupportedVariables");
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not infer sensitive event fields from authored placeholder names", async () => {
    await expect(
      service.enqueueEmailTemplateTest(
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
    ).resolves.toEqual({ jobId: "job-1" });
    expect(enqueue).toHaveBeenCalledTimes(1);
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
