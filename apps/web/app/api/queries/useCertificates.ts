import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAllCertificatesResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";
import type { CertificateType } from "~/types/certificate";

type CertificatesParams = {
  userId: string;
  page?: number;
  perPage?: number;
  language?: SupportedLanguages;
};

type CertificateQueryParams = {
  userId?: string;
  courseId?: string;
  language?: SupportedLanguages;
};

export const certificatesQueryOptions = (params: CertificatesParams) => ({
  queryKey: ["certificates", params.userId, { language: params.language }],
  queryFn: async () => {
    const response = await ApiClient.api.certificatesControllerGetAllCertificates({
      userId: params.userId,
      page: params.page || 1,
      perPage: params.perPage || 100,
      language: params.language,
    });
    return response.data;
  },
  select: (data: GetAllCertificatesResponse): CertificateType[] => data.data,
  enabled: !!params.userId,
});

export const certificateQueryOptions = (params: CertificateQueryParams) => ({
  queryKey: ["certificate", params.userId, params.courseId, { language: params.language }],
  enabled: !!params.userId && !!params.courseId,
  queryFn: async () => {
    const response = await ApiClient.api.certificatesControllerGetCertificate({
      userId: params.userId,
      courseId: params.courseId!,
      language: params.language,
    });
    return response.data;
  },
});

export function useCertificates(params: CertificatesParams) {
  return useQuery(certificatesQueryOptions(params));
}

export function useCertificate(params: CertificateQueryParams) {
  return useQuery(certificateQueryOptions(params));
}
