/** Pages immutable older authoring turns without expanding routine session snapshots. */
import { useInfiniteQuery } from "@tanstack/react-query";

import { getOlderAuthoringTurns } from "../../modules/CourseAuthoring/courseAuthoring.api";

/** Loads older conversation pages only after an editor asks to see them. */
export const useCourseAuthoringTurnHistoryQuery = (
  courseId: string,
  sessionId: string,
  firstBeforeRequestId: string | null | undefined,
) =>
  useInfiniteQuery({
    queryKey: ["course-authoring", courseId, "session", sessionId, "older-turns"],
    initialPageParam: firstBeforeRequestId ?? "",
    queryFn: ({ pageParam }) => getOlderAuthoringTurns(courseId, sessionId, pageParam),
    getNextPageParam: (page) =>
      page.hasMore ? (page.nextBeforeRequestId ?? undefined) : undefined,
    enabled: false,
    staleTime: Infinity,
  });
