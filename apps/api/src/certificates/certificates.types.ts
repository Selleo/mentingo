import type {
  allCertificatesSchema,
  certificateShareLinkResponseSchema,
  certificateSchema,
  createCertificateShareLinkSchema,
  downloadCertificateSchema,
  singleCertificateSchema,
} from "./certificates.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { UUIDType } from "src/common";

export type CertificateResponse = Static<typeof certificateSchema>;
export type SingleCertificateResponse = Static<typeof singleCertificateSchema>;
export type CreateCertificateShareLinkBody = Static<typeof createCertificateShareLinkSchema>;
export type DownloadCertificateBody = Static<typeof downloadCertificateSchema>;
export type CertificateShareLinkResponse = Static<typeof certificateShareLinkResponseSchema>;

export type AllCertificatesResponse = Static<typeof allCertificatesSchema>;

export type CertificatesQuery = {
  userId: UUIDType;
  page?: number;
  perPage?: number;
  sort?: "createdAt";
  language: SupportedLanguages;
};
