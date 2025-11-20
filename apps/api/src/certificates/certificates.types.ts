import type { certificateSchema, allCertificatesSchema } from "./certificates.schema";
import type { SupportedLanguages } from "@repo/shared";
import type { Static } from "@sinclair/typebox";
import type { UUIDType } from "src/common";

export type CertificateResponse = Static<typeof certificateSchema>;

export type AllCertificatesResponse = Static<typeof allCertificatesSchema>;

export type CertificatesQuery = {
  userId: UUIDType;
  page?: number;
  perPage?: number;
  sort?: "createdAt";
  language: SupportedLanguages;
};
