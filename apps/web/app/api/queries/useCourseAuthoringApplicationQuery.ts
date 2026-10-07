/** Polls one queued authoring application until its durable receipt is available. */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { getAuthoringApplication } from "../../modules/CourseAuthoring/courseAuthoring.api";

/** Identifies one course/session/export application cache entry. */
export const authoringApplicationKey = (
  courseId: string,
  sessionId: string | undefined,
  exportId: string | null,
) => ["course-authoring-application", courseId, sessionId, exportId] as const;

/** Defines polling and enablement for the current export status. */
export const authoringApplicationQueryOptions = (
  courseId: string,
  sessionId: string | undefined,
  exportId: string | null,
) =>
  queryOptions({
    queryKey: authoringApplicationKey(courseId, sessionId, exportId),
    queryFn: () => getAuthoringApplication(courseId, sessionId ?? "", exportId ?? ""),
    enabled: Boolean(sessionId && exportId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 2_000 : false;
    },
  });

/** React Query hook for queued authoring application status. */
export const useCourseAuthoringApplicationQuery = (
  courseId: string,
  sessionId: string | undefined,
  exportId: string | null,
) => useQuery(authoringApplicationQueryOptions(courseId, sessionId, exportId));
