import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetContentCreatorCoursesResponse } from "../generated-api";

type SearchParams = {
  scope?: "all" | "enrolled" | "available";
  excludeCourseId?: string;
};

export const contentCreatorCoursesOptions = (authorId?: string, searchParams?: SearchParams) => {
  return {
    enabled: !!authorId,
    queryKey: ["content-creator-courses", authorId],
    queryFn: async () => {
      if (!authorId) {
        throw new Error("Author ID is required");
      }

      const response = await ApiClient.api.courseControllerGetContentCreatorCourses({
        authorId,
        ...(searchParams?.scope && { scope: searchParams.scope }),
        ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
      });

      return response.data;
    },
    select: (data: GetContentCreatorCoursesResponse) => data.data,
  };
};

export function useContentCreatorCourses(authorId?: string, searchParams?: SearchParams) {
  return useQuery(contentCreatorCoursesOptions(authorId, searchParams));
}
