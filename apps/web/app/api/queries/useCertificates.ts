import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAllCertificatesResponse } from "../generated-api";
import type { CertificateType } from "~/types/certificate";

type CertificatesParams = {
  userId: string;
  page?: number;
  perPage?: number;
};

type CertificateQueryParams = {
  userId: string;
  courseId?: string;
};

export const certificatesQueryOptions = (params: CertificatesParams) => ({
  queryKey: ["certificates", params.userId],
  queryFn: async () => {
    const response = await ApiClient.api.certificatesControllerGetAllCertificates({
      userId: params.userId,
      page: params.page || 1,
      perPage: params.perPage || 100,
    });
    return response.data;
  },
  select: (data: GetAllCertificatesResponse): CertificateType[] => data.data,
  enabled: !!params.userId,
});

export const certificateQueryOptions = (params: CertificateQueryParams) => ({
  queryKey: ["certificate", params.userId, params.courseId],
  enabled: !!params.userId && !!params.courseId,
  queryFn: async () => {
    const response = await ApiClient.api.certificatesControllerGetCertificate({
      userId: params.userId,
      courseId: params.courseId!,
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
