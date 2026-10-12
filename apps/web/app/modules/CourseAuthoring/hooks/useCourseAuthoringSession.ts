/** Composes session/context queries with command dispatch and monotonic snapshot refresh. */
import { useCallback } from "react";

import { useCourseAuthoringCommand } from "~/api/mutations/useCourseAuthoringCommand";
import { useCourseAuthoringContextQuery } from "~/api/queries/useCourseAuthoringContextQuery";
import {
  refreshAuthoringSession,
  useCourseAuthoringSessionQuery,
} from "~/api/queries/useCourseAuthoringSessionQuery";

import type { SupportedLanguages } from "@repo/shared";

/** Provides session/context queries, commands, and monotonic snapshot refresh. */
export const useCourseAuthoringSession = (
  courseId: string,
  language: SupportedLanguages,
  sessionId: string,
) => {
  const sessionQuery = useCourseAuthoringSessionQuery(courseId, sessionId);

  // A restored session owns its content language; UI language can differ.
  const sessionLanguage = sessionQuery.data?.language ?? language;
  const contextQuery = useCourseAuthoringContextQuery(
    courseId,
    sessionLanguage,
    Boolean(sessionQuery.data),
  );

  /** Refreshes the current durable snapshot when a session is available. */
  const refetchSnapshot = useCallback(async () => {
    if (!sessionId) return undefined;
    return refreshAuthoringSession(courseId, sessionId);
  }, [courseId, sessionId]);

  const commandMutation = useCourseAuthoringCommand({
    courseId,
    language: sessionLanguage,
    sessionId,
  });

  return {
    sessionQuery,
    contextQuery,
    commandMutation,
    refetchSnapshot,
  };
};
