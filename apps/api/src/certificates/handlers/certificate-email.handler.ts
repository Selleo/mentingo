import { Injectable, Logger } from "@nestjs/common";
import { EMAIL_TEMPLATE_EVENTS } from "@repo/email-templates";

import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { processInBatches } from "src/common/utils/processInBatches";
import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { CertificateExpirationWarningEmailEvent } from "src/events/certificate/certificate-expiration-warning-email.event";
import { NotificationCollectorService } from "src/notifications/services/notification-collector.service";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import type { CertificateActivityReason } from "../certificates.types";
import type { CertificateEmailRecipient } from "src/events/certificate/certificate-email-recipient";
import type { CertificateExpirationWarningEmailRecipient } from "src/events/certificate/certificate-expiration-warning-email.event";
import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

type CertificateEmailEventType =
  | CertificateExpirationWarningEmailEvent
  | CertificateArchivedEmailEvent;

@Injectable()
@OutboxEventsHandler(CertificateExpirationWarningEmailEvent, CertificateArchivedEmailEvent)
export class CertificateEmailHandler implements OutboxEventsHandlerOf<CertificateEmailEventType> {
  private readonly logger = new Logger(CertificateEmailHandler.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly notificationCollectorService: NotificationCollectorService,
  ) {}

  async handleOutboxEvent(event: CertificateEmailEventType, { eventId }: OutboxDeliveryContext) {
    await this.notificationCollectorService.publishCollectedNotifications(eventId, () =>
      this.prepareNotifications(event),
    );
  }

  private async prepareNotifications(event: CertificateEmailEventType) {
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

      await this.notificationCollectorService.captureNotificationRecipient(
        { to: certificate.userEmail },
        {
          tenantId: certificate.tenantId,
          template: {
            event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRATION_WARNING,
            language: defaultEmailSettings.language,
            variables: {
              userEmail: certificate.userEmail,
              userFirstName: certificate.userFirstName,
              userLastName: certificate.userLastName,
              course_name: courseName,
              course_link: courseLink,
              expires_at: expiresAt,
            },
          },
        },
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

      await this.notificationCollectorService.captureNotificationRecipient(
        { to: certificate.userEmail },
        {
          tenantId: certificate.tenantId,
          template: {
            event: EMAIL_TEMPLATE_EVENTS.CERTIFICATE_EXPIRED,
            language: defaultEmailSettings.language,
            variables: {
              userEmail: certificate.userEmail,
              userFirstName: certificate.userFirstName,
              userLastName: certificate.userLastName,
              course_name: courseName,
              course_link: courseLink,
              reason,
            },
          },
        },
      );
    });
  }

  private async processCertificateEmailBatch<T>(
    items: T[],
    processItem: (item: T) => Promise<void>,
  ) {
    await processInBatches(items, processItem, {
      batchSize: EMAIL_BATCH_SIZE,
      throwOnError: true,
      onItemError: (error, _item, itemIndex) => {
        const reason = error instanceof Error ? error.stack : String(error);

        this.logger.error(`Certificate email failed for item ${itemIndex}`, reason);
      },
    });
  }
}
