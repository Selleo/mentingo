import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetCertificatesResponse } from "../generated-api";

type CertificatesParams = {
  userId: string;
  page?: number;
  perPage?: number;
};

export const certificatesQueryOptions = (params: CertificatesParams) => ({
  queryKey: ["certificates", params.userId],
  queryFn: async () => {
    const response = await ApiClient.api.certificateControllerGetCertificates({
      userId: params.userId,
      page: params.page || 1,
      perPage: params.perPage || 100,
    });
    return response.data;
  },
  select: (data: GetCertificatesResponse) => data.data,
  enabled: !!params.userId, // Only run query if userId is provided
});

export function useCertificates(params: CertificatesParams) {
  return useQuery(certificatesQueryOptions(params));
}
