import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export const CERTIFICATE_RESET_OPTIONS_QUERY_KEY = "certificate-reset-options";

export const certificateResetOptionsQueryOptions = (
  courseId: string,
  language?: SupportedLanguages,
  enabled = true,
) => ({
  queryKey: [CERTIFICATE_RESET_OPTIONS_QUERY_KEY, { courseId, language }],
  queryFn: async () => {
    const { data } = await ApiClient.api.certificatesControllerGetCertificateResetOptions(
      courseId,
      { language },
    );
    return data;
  },
  enabled,
});

export function useCertificateResetOptions(
  courseId: string,
  language?: SupportedLanguages,
  enabled = true,
) {
  return useQuery(certificateResetOptionsQueryOptions(courseId, language, enabled));
}
