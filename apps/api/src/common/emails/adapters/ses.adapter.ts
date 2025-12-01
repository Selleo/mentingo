import { SES } from "@aws-sdk/client-ses";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import MailComposer = require("nodemailer/lib/mail-composer");

import { EmailAdapter } from "./email.adapter";

import type { Email } from "../email.interface";
import type { SESClientConfig } from "@aws-sdk/client-ses";

@Injectable()
export class AWSSESAdapter extends EmailAdapter {
  private ses: SES;

  constructor(private configService: ConfigService) {
    super();
    this.ses = new SES(this.getAWSConfig());
  }

  private getAWSConfig(): SESClientConfig {
    const region = this.configService.get<string>("aws.AWS_REGION");
    const accessKeyId = this.configService.get<string>("aws.AWS_ACCESS_KEY_ID");
    const secretAccessKey = this.configService.get<string>("aws.AWS_SECRET_ACCESS_KEY");

    if (!region || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS configuration");
    }

    return {
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    };
  }

  async sendMail(email: Email): Promise<void> {
    const mail = new MailComposer({
      from: email.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      attachments: email.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        cid: a.cid,
        contentType: a.contentType,
      })),
    });

    const message = await mail.compile().build();

    try {
      await this.ses.sendRawEmail({
        RawMessage: { Data: message },
      });
    } catch (error) {
      console.error("Error sending email via AWS SES:", error);
      throw error;
    }
  }
}
