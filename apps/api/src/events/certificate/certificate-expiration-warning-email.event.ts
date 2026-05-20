import type { CertificateEmailRecipient } from "./certificate-email-recipient";

export type CertificateExpirationWarningEmailRecipient = CertificateEmailRecipient & {
  expiresAt: string;
};

type CertificateExpirationWarningEmailData = {
  certificates: CertificateExpirationWarningEmailRecipient[];
};

export class CertificateExpirationWarningEmailEvent {
  constructor(
    public readonly certificateExpirationWarningEmailData: CertificateExpirationWarningEmailData,
  ) {}
}
