/** Loads a searchable, incrementally-loaded page set of a course's thread browser for the session-switcher popover. */
import { useInfiniteQuery } from "@tanstack/react-query";

import { listAuthoringSessions } from "~/modules/CourseAuthoring/courseAuthoring.api";

export const INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY = "course-authoring-sessions-infinite";

type InfiniteCourseAuthoringSessionsParams = {
  courseId: string;
  tenantScope?: string;
  keyword?: string;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const infiniteCourseAuthoringSessionsQueryOptions = (
  { courseId, tenantScope, keyword, perPage = 20 }: InfiniteCourseAuthoringSessionsParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [
    INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY,
    courseId,
    tenantScope,
    keyword,
    perPage,
  ],
  queryFn: async ({ pageParam }: { pageParam: number }) =>
    listAuthoringSessions(courseId, { page: pageParam, perPage, ...(keyword && { keyword }) }),
  getNextPageParam: (lastPage: Awaited<ReturnType<typeof listAuthoringSessions>>) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useInfiniteCourseAuthoringSessionsQuery(
  params: InfiniteCourseAuthoringSessionsParams,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(infiniteCourseAuthoringSessionsQueryOptions(params, options));
}
