import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const useCertificateBackground = (courseId: string) => {
  return useQuery({
    queryKey: ["certificateBackground", courseId],
    queryFn: async () => {
      if (!courseId) {
        throw new Error("Course ID is required to fetch certificate background.");
      }
      const response = await ApiClient.api.courseControllerGetCertificateBackground(courseId);
      return response.data;
    },
    enabled: !!courseId,
  });
};
