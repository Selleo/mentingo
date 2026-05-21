import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const CERTIFICATE_RESET_OPTIONS_QUERY_KEY = "certificate-reset-options";

export const certificateResetOptionsQueryOptions = (courseId: string, enabled = true) => ({
  queryKey: [CERTIFICATE_RESET_OPTIONS_QUERY_KEY, courseId],
  queryFn: async () => {
    const { data } = await ApiClient.api.certificatesControllerGetCertificateResetOptions(courseId);
    return data;
  },
  enabled,
});

export function useCertificateResetOptions(courseId: string, enabled = true) {
  return useQuery(certificateResetOptionsQueryOptions(courseId, enabled));
}
