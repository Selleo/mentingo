import type { GetCertificateResetUsersResponse } from "~/api/generated-api";

export type CertificateResetUser = GetCertificateResetUsersResponse["data"][number];

export type CertificateResetUsersParams = {
  courseId: string;
  page?: number;
  perPage?: number;
  search?: string;
};

export type CertificateResetUsersQueryOptions = {
  enabled?: boolean;
};
