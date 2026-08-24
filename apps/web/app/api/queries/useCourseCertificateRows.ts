import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export const COURSE_CERTIFICATE_ROWS_QUERY_KEY = "course-certificate-rows";

export const useCourseCertificateRows = (
  courseId: string,
  language: SupportedLanguages,
  search?: string,
  enabled = true,
) =>
  useQuery({
    queryKey: [COURSE_CERTIFICATE_ROWS_QUERY_KEY, courseId, language, search],
    queryFn: async () => {
      const { data } = await ApiClient.api.certificatesControllerGetCourseCertificateRows(
        courseId,
        { language, search },
      );
      return data.data;
    },
    enabled: enabled && Boolean(courseId),
  });
