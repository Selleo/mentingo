import type { CertificateResetScope } from "@repo/shared";
import type { CertificateResetUser } from "~/api/queries/useCertificateResetUsers.types";

export type CertificateResetGroup = {
  id: string;
  name: string;
  activeCertificateCount: number;
};

export type { CertificateResetScope, CertificateResetUser };
