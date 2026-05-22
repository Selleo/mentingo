import type { CertificateEmailRecipient } from "./certificate-email-recipient";
import type { CertificateActivityReason } from "src/certificates/certificates.types";

type CertificateArchivedEmailData = {
  certificates: CertificateEmailRecipient[];
  reason: CertificateActivityReason;
};

export class CertificateArchivedEmailEvent {
  constructor(public readonly certificateArchivedEmailData: CertificateArchivedEmailData) {}
}
