import { useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import { getCourseQueryKey } from "./useCourse";

import type { SupportedLanguages } from "@repo/shared";

export function useCourseAvailabilitySuspense(idOrSlug: string, language: SupportedLanguages) {
  return useSuspenseQuery({
    queryKey: [...getCourseQueryKey(idOrSlug, language), "availability"],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.courseControllerGetCourse({ id: idOrSlug, language });
        return response.data.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
  });
}
