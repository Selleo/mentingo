/** Loads and refreshes the durable authoring snapshot without regressing the local cursor. */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { queryClient } from "~/api/queryClient";

import { getAuthoringSession } from "../../modules/CourseAuthoring/courseAuthoring.api";

import type { AuthoringSession } from "../../modules/CourseAuthoring/courseAuthoring.types";

/** Identifies one localized authoring session projection. */
export const authoringSessionKey = (courseId: string, sessionId: string) =>
  ["course-authoring", courseId, "session", sessionId] as const;

/** Defines durable snapshot loading and bounded retry behavior. */
export const authoringSessionQueryOptions = (courseId: string, sessionId: string) =>
  queryOptions({
    queryKey: authoringSessionKey(courseId, sessionId),
    queryFn: () => getAuthoringSession(courseId, sessionId),
    enabled: Boolean(courseId && sessionId),
    staleTime: 15_000,
    retry: 1,
  });

/** Refreshes a snapshot without replacing a newer websocket projection. */
export const refreshAuthoringSession = async (
  courseId: string,
  sessionId: string,
) => {
  const snapshot = await getAuthoringSession(courseId, sessionId);
  queryClient.setQueryData<AuthoringSession>(authoringSessionKey(courseId, sessionId), (current) =>
    !current || snapshot.snapshotSequence >= current.snapshotSequence ? snapshot : current,
  );
  return snapshot;
};

/** React Query hook for opening and caching the authoring session. */
export const useCourseAuthoringSessionQuery = (courseId: string, sessionId: string) =>
  useQuery(authoringSessionQueryOptions(courseId, sessionId));
