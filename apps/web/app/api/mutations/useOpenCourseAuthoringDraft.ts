import { useMutation } from "@tanstack/react-query";

import { authoringSessionKey } from "~/api/queries/useCourseAuthoringSessionQuery";
import { queryClient } from "~/api/queryClient";
import { openAuthoringDraft } from "~/modules/CourseAuthoring/courseAuthoring.api";

import type { SupportedLanguages } from "@repo/shared";
import type { AuthoringSessionCommandId } from "~/modules/CourseAuthoring/authoringSessionSelection";

/** Opens a draft using the same creation command across an interrupted attempt. */
export const useOpenCourseAuthoringDraft = (language: SupportedLanguages) =>
  useMutation({
    mutationFn: (commandId: AuthoringSessionCommandId) => openAuthoringDraft(language, commandId),
    retry: false,
    onSuccess: (session) => {
      queryClient.setQueryData(authoringSessionKey(session.courseId, session.sessionId), session);
    },
  });
