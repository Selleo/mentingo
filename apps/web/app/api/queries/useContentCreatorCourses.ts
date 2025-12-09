import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetContentCreatorCoursesResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

type SearchParams = {
  scope?: "all" | "enrolled" | "available";
  excludeCourseId?: string;
  /** Filter by course title only */
  title?: string;
  /** Filter by course description only */
  description?: string;
  /** Search across both title AND description fields simultaneously */
  searchQuery?: string;

  language?: SupportedLanguages;
};

type QueryOptions = {
  enabled?: boolean;
};

export const contentCreatorCoursesOptions = (
  authorId?: string,
  searchParams?: SearchParams,
  isContentCreator?: boolean,
  options: QueryOptions = { enabled: true },
) => {
  return {
    enabled: !!authorId && isContentCreator,
    queryKey: ["content-creator-courses", authorId, { language: searchParams?.language }],
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
        ...(searchParams?.title && { title: searchParams.title }),
        ...(searchParams?.description && { description: searchParams.description }),
        ...(searchParams?.searchQuery && { searchQuery: searchParams.searchQuery }),
        ...(searchParams?.language && { language: searchParams.language }),
      });

      return response.data;
    },
    select: (data: GetContentCreatorCoursesResponse) => data.data,
    ...options,
  };
};

export function useContentCreatorCourses(
  authorId?: string,
  searchParams?: SearchParams,
  isContentCreator?: boolean,
) {
  return useQuery(contentCreatorCoursesOptions(authorId, searchParams, isContentCreator));
}
