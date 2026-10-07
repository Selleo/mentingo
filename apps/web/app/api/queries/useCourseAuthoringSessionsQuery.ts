/** Loads the compact persisted thread browser for one course. */
import { useQuery } from "@tanstack/react-query";

import { listAuthoringSessions } from "~/modules/CourseAuthoring/courseAuthoring.api";

/** Keeps every selected timeline beneath the same course-scoped browser cache. */
export const authoringSessionsKey = (courseId: string, tenantScope?: string) =>
  ["course-authoring", courseId, "sessions", tenantScope] as const;

/** Reads summaries only; a selected session loads its own full snapshot separately. */
export const useCourseAuthoringSessionsQuery = (courseId: string, tenantScope?: string) =>
  useQuery({
    queryKey: authoringSessionsKey(courseId, tenantScope),
    queryFn: async () => (await listAuthoringSessions(courseId)).data,
    enabled: Boolean(courseId),
    staleTime: 15_000,
  });
