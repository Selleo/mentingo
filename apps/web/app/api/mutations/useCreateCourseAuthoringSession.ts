/** Creates a new independent authoring conversation and refreshes the thread browser. */
import { useMutation } from "@tanstack/react-query";

import { authoringSessionsKey } from "~/api/queries/useCourseAuthoringSessionsQuery";
import { INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY } from "~/api/queries/useInfiniteCourseAuthoringSessionsQuery";
import { queryClient } from "~/api/queryClient";
import { openAuthoringSession } from "~/modules/CourseAuthoring/courseAuthoring.api";

import type { SupportedLanguages } from "@repo/shared";
import type { AuthoringSessionCommandId } from "~/modules/CourseAuthoring/authoringSessionSelection";

/** Starts one conversation using a caller-supplied idempotency key when recovery needs one. */
export const useCreateCourseAuthoringSession = (courseId: string, language: SupportedLanguages) =>
  useMutation({
    mutationFn: (commandId: AuthoringSessionCommandId | undefined) =>
      openAuthoringSession(courseId, language, commandId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authoringSessionsKey(courseId) });
      await queryClient.invalidateQueries({
        queryKey: [INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY, courseId],
      });
    },
  });
