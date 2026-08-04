import { TENANT_LOGO_CID, TENANT_LOGO_CID_SRC } from "@repo/shared";

import { EmailService } from "../emails.service";

const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const BORDER_CIRCLE_CID = "border-circle";

const makeService = (adapter: "mailhog" | "smtp" | "ses" = "mailhog") => {
  const emailAdapter = {
    sendMail: jest.fn(),
  };
  const settingsService = {
    getPlatformLogoBuffer: jest.fn().mockResolvedValue(Buffer.from("logo")),
    getEmailBorderCircleBuffer: jest.fn().mockResolvedValue(Buffer.from("border")),
  };
  const tenantRunner = {
    runWithTenant: jest.fn((_tenantId: string, fn: () => Promise<unknown>) => fn()),
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "email.SMTP_EMAIL_FROM") return "noreply@example.com";
      if (key === "email.EMAIL_ADAPTER") return adapter;
      return undefined;
    }),
  };

  const service = new EmailService(
    {} as never,
    emailAdapter as never,
    settingsService as never,
    tenantRunner as never,
    configService as never,
  );

  return { service, emailAdapter, tenantRunner };
};

describe("EmailService", () => {
  it("adds inline content ids for Mailhog mailbox rendering", async () => {
    const { service, emailAdapter, tenantRunner } = makeService();

    await service.sendEmailWithLogo(
      {
        to: "learner@example.com",
        subject: "Subject",
        html: `<img src="${TENANT_LOGO_CID_SRC}" alt="logo" />`,
      },
      { tenantId: TENANT_ID },
    );

    expect(tenantRunner.runWithTenant).toHaveBeenCalledWith(TENANT_ID, expect.any(Function));
    expect(emailAdapter.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "noreply@example.com",
        attachments: [
          expect.objectContaining({
            filename: "logo.png",
            cid: TENANT_LOGO_CID,
            contentType: "image/png",
          }),
          expect.objectContaining({
            filename: "border-circle.png",
            cid: BORDER_CIRCLE_CID,
            contentType: "image/png",
          }),
        ],
      }),
    );
  });

  it.each(["smtp", "ses"] as const)("adds inline content ids for %s", async (adapter) => {
    const { service, emailAdapter } = makeService(adapter);

    await service.sendEmailWithLogo(
      {
        to: "learner@example.com",
        subject: "Subject",
        html: `<img src="${TENANT_LOGO_CID_SRC}" alt="logo" />`,
      },
      { tenantId: TENANT_ID },
    );

    const payload = emailAdapter.sendMail.mock.calls[0][0];
    expect(payload.attachments).toEqual([
      expect.objectContaining({
        filename: "logo.png",
        cid: TENANT_LOGO_CID,
        contentType: "image/png",
      }),
      expect.objectContaining({
        filename: "border-circle.png",
        cid: BORDER_CIRCLE_CID,
        contentType: "image/png",
      }),
    ]);
  });
});
