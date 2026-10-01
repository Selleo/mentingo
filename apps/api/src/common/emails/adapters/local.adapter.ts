import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";

import { EmailAdapter } from "./email.adapter";

import type { Email } from "../email.interface";

@Injectable()
export class LocalAdapter extends EmailAdapter {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    super();

    let host = this.configService.get<string>("email.SMTP_HOST");
    let port = this.configService.get<number>("email.SMTP_PORT");

    if (!host) {
      host = "localhost";
    }
    if (!port) {
      port = 1025;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      ignoreTLS: true,
      tls: {
        rejectUnauthorized: false,
      },
      auth: undefined,
    });
  }

  async sendMail(email: Email): Promise<void> {
    await this.transporter.sendMail(this.prepareEmailForPreview(email));
  }

  private prepareEmailForPreview(email: Email) {
    // Use data URLs to avoid MailHog's multipart/related rendering issues.
    const imageUrls = new Map<string, string>();

    const attachments = email.attachments?.map((attachment) => {
      const { cid, ...downloadAttachment } = attachment;
      const { content, contentType = "application/octet-stream" } = downloadAttachment;
      if (!cid || content === undefined) return attachment;

      const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
      const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
      imageUrls.set(cid, dataUrl);

      return downloadAttachment;
    });

    const html = email.html?.replace(
      /cid:([^"'\s<>]+)/g,
      (reference, cid: string) => imageUrls.get(cid) ?? reference,
    );

    return { ...email, ...(html ? { html } : {}), attachments };
  }
}
