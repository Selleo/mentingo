import * as nodemailer from "nodemailer";

import { LocalAdapter } from "./local.adapter";

import type { ConfigService } from "@nestjs/config";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("LocalAdapter", () => {
  const sendMail = jest.fn().mockResolvedValue({});
  let adapter: LocalAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(nodemailer.createTransport)
      .mockReturnValue({ sendMail } as unknown as nodemailer.Transporter);
    adapter = new LocalAdapter({ get: () => undefined } as unknown as ConfigService);
  });

  it("embeds branding and uploaded images without creating related MIME parts", async () => {
    const attachments = ["logo", "border-circle", "uploaded-image"].map((cid) => ({
      cid,
      filename: `${cid}.png`,
      contentType: "image/png",
      content: Buffer.from(cid),
    }));
    const html = attachments.map(({ cid }) => `<img src="cid:${cid}">`).join("");
    await adapter.sendMail({
      from: "sender@example.test",
      to: "recipient@example.test",
      subject: "Images",
      html,
      attachments,
    });
    const sent = sendMail.mock.calls[0][0];
    for (const attachment of attachments) {
      expect(sent.html).toContain(
        `src="data:image/png;base64,${attachment.content.toString("base64")}"`,
      );
      expect(attachment.cid).toBeDefined();
    }
    expect(sent.html).not.toContain("cid:");
    expect(sent.attachments.every((attachment: { cid?: string }) => !attachment.cid)).toBe(true);
    expect(sent.attachments).toHaveLength(3);
  });

  it("preserves plain text messages and ordinary attachments", async () => {
    const email = {
      from: "sender@example.test",
      to: "recipient@example.test",
      subject: "Document",
      text: "Document",
      attachments: [{ filename: "document.pdf", content: Buffer.from("pdf") }],
    };
    await adapter.sendMail(email);
    expect(sendMail).toHaveBeenCalledWith(email);
  });
});
