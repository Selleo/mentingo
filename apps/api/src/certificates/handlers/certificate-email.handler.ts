import { Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { CertificateExpiredEmail, CertificateExpirationWarningEmail } from "@repo/email-templates";

import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { processInBatches } from "src/common/utils/processInBatches";
import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { CertificateExpirationWarningEmailEvent } from "src/events/certificate/certificate-expiration-warning-email.event";

import type { CertificateActivityReason } from "../certificates.types";
import type { CertificateEmailRecipient } from "src/events/certificate/certificate-email-recipient";
import type { CertificateExpirationWarningEmailRecipient } from "src/events/certificate/certificate-expiration-warning-email.event";

type CertificateEmailEventType =
  | CertificateExpirationWarningEmailEvent
  | CertificateArchivedEmailEvent;

const CertificateEmailEvents = [
  CertificateExpirationWarningEmailEvent,
  CertificateArchivedEmailEvent,
] as const;

@EventsHandler(...CertificateEmailEvents)
export class CertificateEmailHandler implements IEventHandler<CertificateEmailEventType> {
  private readonly logger = new Logger(CertificateEmailHandler.name);

  constructor(private readonly emailService: EmailService) {}

  async handle(event: CertificateEmailEventType) {
    if (event instanceof CertificateExpirationWarningEmailEvent) {
      await this.sendExpirationWarningEmails(
        event.certificateExpirationWarningEmailData.certificates,
      );

      return;
    }

    if (event instanceof CertificateArchivedEmailEvent) {
      await this.sendArchivedCertificateEmails(
        event.certificateArchivedEmailData.certificates,
        event.certificateArchivedEmailData.reason,
      );
    }
  }

  private async sendExpirationWarningEmails(
    certificatesToWarn: CertificateExpirationWarningEmailRecipient[],
  ) {
    await this.processCertificateEmailBatch(certificatesToWarn, async (certificate) => {
      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        certificate.tenantId,
        certificate.userId,
      );

      const { courseName, courseLink, expiresAt } = certificate;

      const { text, html } = new CertificateExpirationWarningEmail({
        courseName,
        courseLink,
        expiresAt,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo(
        {
          to: certificate.userEmail,
          subject: getEmailSubject(
            "certificateExpirationWarningEmail",
            defaultEmailSettings.language,
            { courseName },
          ),
          text,
          html,
        },
        { tenantId: certificate.tenantId },
      );
    });
  }

  private async sendArchivedCertificateEmails(
    archivedCertificates: CertificateEmailRecipient[],
    reason: CertificateActivityReason,
  ) {
    await this.processCertificateEmailBatch(archivedCertificates, async (certificate) => {
      const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
        certificate.tenantId,
        certificate.userId,
      );

      const { courseName, courseLink } = certificate;

      const { text, html } = new CertificateExpiredEmail({
        courseName,
        courseLink,
        reason,
        ...defaultEmailSettings,
      });

      await this.emailService.sendEmailWithLogo(
        {
          to: certificate.userEmail,
          subject: getEmailSubject("certificateExpiredEmail", defaultEmailSettings.language, {
            courseName,
          }),
          text,
          html,
        },
        { tenantId: certificate.tenantId },
      );
    });
  }

  private async processCertificateEmailBatch<T>(
    items: T[],
    processItem: (item: T) => Promise<void>,
  ) {
    await processInBatches(items, processItem, {
      batchSize: EMAIL_BATCH_SIZE,
      throwOnError: false,
      onItemError: (error, _item, itemIndex) => {
        const reason = error instanceof Error ? error.stack : String(error);

        this.logger.error(`Certificate email failed for item ${itemIndex}`, reason);
      },
    });
  }
}
