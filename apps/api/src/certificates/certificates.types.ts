import type { certificateSchema, allCertificatesSchema } from "./certificates.schema";
import type { Static } from "@sinclair/typebox";

export type CertificateResponse = Static<typeof certificateSchema>;

export type AllCertificatesResponse = Static<typeof allCertificatesSchema>;

export type CertificatesQuery = {
  userId: string;
  page?: number;
  perPage?: number;
  sort?: "createdAt";
};
