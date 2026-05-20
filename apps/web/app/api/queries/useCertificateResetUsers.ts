import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type {
  CertificateResetUsersParams,
  CertificateResetUsersQueryOptions,
} from "./useCertificateResetUsers.types";

export const CERTIFICATE_RESET_USERS_QUERY_KEY = ["certificate-reset-users"] as const;

export const certificateResetUsersQueryOptions = (
  { courseId, ...params }: CertificateResetUsersParams,
  options: CertificateResetUsersQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...CERTIFICATE_RESET_USERS_QUERY_KEY, courseId, params],
    queryFn: async () => {
      const { data } = await ApiClient.api.certificatesControllerGetCertificateResetUsers(
        courseId,
        params,
      );
      return data;
    },
    ...options,
    select: ({ data, pagination }) => ({
      users: data,
      pagination,
    }),
  });

export function useCertificateResetUsers(
  params: CertificateResetUsersParams,
  options?: CertificateResetUsersQueryOptions,
) {
  return useQuery(certificateResetUsersQueryOptions(params, options));
}

export function useCertificateResetUsersSuspense(
  params: CertificateResetUsersParams,
  options?: CertificateResetUsersQueryOptions,
) {
  return useSuspenseQuery(certificateResetUsersQueryOptions(params, options));
}
