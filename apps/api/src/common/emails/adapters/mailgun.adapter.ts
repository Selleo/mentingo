import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import FormData from "form-data";
import Mailgun from "mailgun.js";

import { EmailAdapter } from "./email.adapter";

import type { Email } from "../email.interface";
import type {
  Interfaces,
  MailgunClientOptions,
  MailgunMessageData,
} from 'mailgun.js/definitions';


@Injectable()
export class MailgunAdapter extends EmailAdapter {
  private client: Interfaces.IMailgunClient
  private domain: string;
  private logger = new Logger(MailgunAdapter.name);

  constructor(private configService: ConfigService) {
    super();

    const mailgunDomain = this.configService.get<string>("MAILGUN_DOMAIN");
    if (!mailgunDomain) {
      throw new Error("Mailgun domain (MAILGUN_DOMAIN) is not configured.");
    }

    this.domain = mailgunDomain;

    const mailgun = new Mailgun(FormData);
    const config = this.getMailgunConfig();

    this.client = mailgun.client(config);
  }

  private getMailgunConfig(): MailgunClientOptions {
    const apiKey = this.configService.get<string>("MAILGUN_KEY");

    if (!apiKey) {
      throw new Error("Mailgun API key (MAILGUN_KEY) is not configured.");
    }

    return { key: apiKey, username: "api", };
  }

  async sendMail(email: Email): Promise<void> {
    const { from, to, subject, text, html } = email;

    let mailgunPayload: MailgunMessageData;

    if (html) {
      mailgunPayload = { from, to, subject, html };
      if (text) {
        mailgunPayload.text = text;
      }
    } else if (text) {
      mailgunPayload = { from, to, subject, text };
    } else {
      throw new Error(
        "Email must have text or html content if not using a mailgun template.",
      );
    }

    try {
      await this.client.messages.create(this.domain, mailgunPayload);
      this.logger.log("Email sent via Mailgun");
    } catch (error) {
      this.logger.error("Error sending email via Mailgun:", error);
      throw error;
    }
  }
}
