import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetContentCreatorCoursesResponse } from "../generated-api";

type SearchParams = {
  scope?: "all" | "enrolled" | "available";
  excludeCourseId?: string;
};

export const ContentCreatorCoursesOptions = (
  authorId?: string,
  searchParams?: SearchParams,
  isContentCreator?: boolean,
) => {
  return {
    enabled: !!authorId && isContentCreator,
    queryKey: ["contentCreator-courses", authorId],
    queryFn: async () => {
      if (!authorId) {
        throw new Error("Author ID is required");
      }

      if (!isContentCreator) {
        throw new Error("Author must be a content creator");
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

export function useContentCreatorCourses(
  authorId?: string,
  searchParams?: SearchParams,
  isContentCreator?: boolean,
) {
  return useQuery(ContentCreatorCoursesOptions(authorId, searchParams, isContentCreator));
}
