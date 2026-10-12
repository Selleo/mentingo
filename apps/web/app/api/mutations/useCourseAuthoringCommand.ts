/** Sends one workspace command and refreshes its durable session projection. */
import { useMutation } from "@tanstack/react-query";

import { sendAuthoringCommand } from "../../modules/CourseAuthoring/courseAuthoring.api";
import {
  authoringSessionKey,
  refreshAuthoringSession,
} from "../queries/useCourseAuthoringSessionQuery";
import { authoringSessionsKey } from "../queries/useCourseAuthoringSessionsQuery";
import { INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY } from "../queries/useInfiniteCourseAuthoringSessionsQuery";
import { queryClient } from "../queryClient";

import type { AuthoringCommand } from "../../modules/CourseAuthoring/courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

type CommandInput = Omit<AuthoringCommand, "schemaVersion" | "commandId"> & {
  commandId?: string;
};

type Options = {
  courseId: string;
  language: SupportedLanguages;
  sessionId?: string;
};

/** React Query mutation for commands against the active session. */
export const useCourseAuthoringCommand = ({ courseId, sessionId }: Options) =>
  useMutation({
    mutationFn: (command: CommandInput) => {
      if (!sessionId) {
        throw new Error("AUTHORING_SESSION_NOT_READY");
      }

      return sendAuthoringCommand(courseId, sessionId, command);
    },
    onSuccess: async () => {
      if (!sessionId) {
        return;
      }

      try {
        await refreshAuthoringSession(courseId, sessionId);
        await queryClient.invalidateQueries({ queryKey: authoringSessionsKey(courseId) });
        await queryClient.invalidateQueries({
          queryKey: [INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY, courseId],
        });
      } catch {
        // The command was accepted; a failed read must not invite a duplicate submission.
        await queryClient.invalidateQueries({ queryKey: authoringSessionKey(courseId, sessionId) });
      }
    },
  });
