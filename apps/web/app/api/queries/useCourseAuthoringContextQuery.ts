/** Caches the localized native course context used to build authoring targets. */
import { queryOptions, useQuery } from "@tanstack/react-query";

import { getAuthoringCourseContext } from "../../modules/CourseAuthoring/courseAuthoring.api";

import type { CourseContext } from "../../modules/CourseAuthoring/courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

/** Identifies localized native context for one course. */
export const authoringContextKey = (courseId: string, language: SupportedLanguages) =>
  ["course-authoring-context", courseId, language] as const;

/** Defines cache freshness for the localized authoring context. */
export const authoringContextQueryOptions = (
  courseId: string,
  language: SupportedLanguages,
  enabled = true,
) =>
  queryOptions({
    queryKey: authoringContextKey(courseId, language),
    queryFn: (): Promise<CourseContext> => getAuthoringCourseContext(courseId, language),
    enabled: enabled && Boolean(courseId),
    staleTime: 30_000,
  });

/** React Query hook for native course target context. */
export const useCourseAuthoringContextQuery = (
  courseId: string,
  language: SupportedLanguages,
  enabled = true,
) => useQuery(authoringContextQueryOptions(courseId, language, enabled));
