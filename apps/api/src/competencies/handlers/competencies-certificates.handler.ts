import { Injectable, type OnModuleInit } from "@nestjs/common";

import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { OutboxDirectHandlerService } from "src/outbox/outbox-direct-handler.service";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";

import { CompetenciesSyncService } from "../competencies-sync.service";

@Injectable()
export class CompetenciesCertificatesHandler implements OnModuleInit {
  constructor(
    private readonly competenciesSyncService: CompetenciesSyncService,
    private readonly outboxDirectHandlerService: OutboxDirectHandlerService,
  ) {}
  onModuleInit() {
    this.outboxDirectHandlerService.registerReaction(
      CertificateArchivedEmailEvent.name,
      (payload, eventId) =>
        this.enqueueArchivedCertificateFacts(
          materializeLegacyEvent(
            CertificateArchivedEmailEvent.name,
            payload,
          ) as CertificateArchivedEmailEvent,
          eventId,
        ),
    );
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
