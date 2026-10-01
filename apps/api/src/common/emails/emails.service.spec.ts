import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailService } from "./emails.service";

import type { EmailAdapter } from "./adapters/email.adapter";
import type { ConfigService } from "@nestjs/config";
import type { DatabasePg } from "src/common";
import type { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import type { SettingsService } from "src/settings/settings.service";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe.each(["mailhog", "smtp"])("EmailService template delivery (%s)", (adapter) => {
  const sendMail = jest.fn();
  const renderPublishedEmailTemplate = jest.fn();
  const logo = Buffer.from("logo");
  const borderCircle = Buffer.from("border-circle");
  const service = new EmailService(
    {} as DatabasePg,
    { sendMail } as EmailAdapter,
    {
      getPlatformLogoBuffer: async () => logo,
      getEmailBorderCircleBuffer: async () => borderCircle,
      getGlobalSettings: async () => ({ companyInformation: { companyName: "Tenant" } }),
    } as unknown as SettingsService,
    { runWithTenant: async (_id, callback) => callback() } as TenantDbRunnerService,
    {
      get: (key: string) => (key === "email.SMTP_EMAIL_FROM" ? "sender@example.com" : adapter),
    } as ConfigService,
    { renderPublishedEmailTemplate } as unknown as EmailTemplateRenderingService,
  );
  const email = {
    to: "learner@example.com",
    subject: "Default",
    text: "Default text",
    html: "<p>Default</p>",
  };
  const options = {
    tenantId: "tenant-id",
    template: {
      event: EMAIL_TEMPLATE_EVENTS.WELCOME,
      language: SUPPORTED_LANGUAGES.EN,
      variables: { courses_link: "https://tenant.example/courses" },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    renderPublishedEmailTemplate.mockResolvedValue(undefined);
  });

  it("preserves existing default rendering when there is no published override", async () => {
    await service.sendEmailWithLogo(email, options);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ ...email, from: "sender@example.com" }),
    );
  });

  it("replaces only content and preserves recipients, sender, existing attachments and tenant logo", async () => {
    const existingAttachment = { filename: "certificate.pdf", content: Buffer.from("pdf") };
    const customAttachment = { filename: "image.png", content: Buffer.from("image"), cid: "image" };
    renderPublishedEmailTemplate.mockResolvedValue({
      subject: "Custom",
      html: "<p>Custom</p>",
      text: "Custom",
      attachments: [customAttachment],
    });
    await service.sendEmailWithLogo({ ...email, attachments: [existingAttachment] }, options);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: email.to,
        from: "sender@example.com",
        subject: "Custom",
        text: "Custom",
        html: "<p>Custom</p>",
        attachments: [
          existingAttachment,
          customAttachment,
          expect.objectContaining({
            cid: "logo",
            content: logo,
          }),
          expect.objectContaining({
            cid: "border-circle",
            content: borderCircle,
          }),
        ],
      }),
    );
    expect(renderPublishedEmailTemplate).toHaveBeenCalledWith(
      options.tenantId,
      options.template,
      expect.objectContaining({
        companyName: "Tenant",
        logoUrl: "cid:logo",
        borderCircleUrl: "cid:border-circle",
      }),
    );
  });

  it("does not resolve overrides for already-rendered test emails or legacy queued payloads", async () => {
    await service.sendEmailWithLogo(email, { tenantId: options.tenantId });
    expect(renderPublishedEmailTemplate).not.toHaveBeenCalled();
  });

  it("embeds the tenant decorative image in browser previews", async () => {
    expect(await service.getEmailPreviewBorderCircle(options.tenantId)).toBe(
      `data:image/png;base64,${borderCircle.toString("base64")}`,
    );
  });

  it.each([false, true])(
    "matches branding Content-IDs to HTML references (override=%s)",
    async (override) => {
      const html = '<img src="cid:logo"><img src="cid:border-circle">';
      if (override)
        renderPublishedEmailTemplate.mockResolvedValue({
          subject: "Custom",
          html,
          text: "Custom",
          attachments: [],
        });
      await service.sendEmailWithLogo({ ...email, html }, options);
      const sent = sendMail.mock.calls[0][0];
      expect(sent.html).toBe(html);
      expect(sent.attachments.map((attachment: { cid?: string }) => attachment.cid)).toEqual([
        "logo",
        "border-circle",
      ]);
    },
  );
});
