import { Injectable } from "@nestjs/common";

import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { CompetenciesSyncService } from "../competencies-sync.service";

import type { OutboxDeliveryContext, OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(CertificateArchivedEmailEvent)
export class CompetenciesCertificatesHandler
  implements OutboxEventsHandlerOf<CertificateArchivedEmailEvent>
{
  constructor(private readonly competenciesSyncService: CompetenciesSyncService) {}

  async handleOutboxEvent(
    event: CertificateArchivedEmailEvent,
    { eventId }: OutboxDeliveryContext,
  ) {
    await this.enqueueArchivedCertificateFacts(event, eventId);
  }

  async enqueueArchivedCertificateFacts(event: CertificateArchivedEmailEvent, eventId: string) {
    for (const person of event.certificateArchivedEmailData.certificates)
      await this.competenciesSyncService.enqueueSubjectLearningFacts(
        person.tenantId,
        person.userId,
        eventId,
      );
  }
}
