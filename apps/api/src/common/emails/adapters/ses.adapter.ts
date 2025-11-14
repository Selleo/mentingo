import { SES, type SESClientConfig } from "@aws-sdk/client-ses";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { EmailAdapter } from "./email.adapter";

import type { Email } from "../email.interface";

@Injectable()
export class AWSSESAdapter extends EmailAdapter {
  private ses: SES;

  constructor(private configService: ConfigService) {
    super();
    const config: SESClientConfig = this.getAWSConfig();
    this.ses = new SES(config);
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
    const params: any = {
      FromEmailAddress: email.from,
      Destination: {
        ToAddresses: [email.to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: email.subject,
          },
          Body: {
            ...(email.text && {
              Text: {
                Data: email.text,
              },
            }),
            ...(email.html && {
              Html: {
                Data: email.html,
              },
            }),
          },
          ...(email.attachments &&
            email.attachments.length > 0 && {
              Attachments: email.attachments.map((attachment) => {
                let base64Content: string;
                if (attachment.content) {
                  if (Buffer.isBuffer(attachment.content)) {
                    base64Content = attachment.content.toString("base64");
                  } else {
                    base64Content = Buffer.from(attachment.content).toString("base64");
                  }
                } else if (attachment.path) {
                  throw new Error("File path attachments not yet supported in SES adapter");
                } else {
                  throw new Error("Attachment must have either content or path");
                }

                return {
                  RawContent: base64Content,
                  ContentDisposition: attachment.cid ? "INLINE" : "ATTACHMENT",
                  FileName: attachment.filename,
                  ...(attachment.contentType && {
                    ContentType: attachment.contentType,
                  }),
                  ...(attachment.cid && {
                    ContentId: attachment.cid,
                  }),
                  ContentTransferEncoding: "BASE64",
                };
              }),
            }),
        },
      },
    };

    try {
      await this.ses.sendEmail(params);
    } catch (error) {
      console.error("Error sending email via AWS SES:", error);
      throw error;
    }
  }
}
