/** Sends workspace commands and lets the socket project live session updates. */
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { sendAuthoringCommand } from "../../modules/CourseAuthoring/courseAuthoring.api";
import { AUTHORING_TASK_STATUS } from "../../modules/CourseAuthoring/courseAuthoring.constants";
import {
  authoringSessionKey,
  refreshAuthoringSession,
} from "../queries/useCourseAuthoringSessionQuery";
import { authoringSessionsKey } from "../queries/useCourseAuthoringSessionsQuery";
import { INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY } from "../queries/useInfiniteCourseAuthoringSessionsQuery";
import { queryClient } from "../queryClient";

import type {
  AuthoringCommand,
  AuthoringSession,
} from "../../modules/CourseAuthoring/courseAuthoring.types";
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
    onSuccess: async (receipt, command) => {
      if (!sessionId) {
        return;
      }

      const { requestId, taskIds } = receipt;
      if (command.action === "request.create" && requestId && taskIds?.length) {
        queryClient.setQueryData<AuthoringSession>(
          authoringSessionKey(courseId, sessionId),
          (current) => {
            if (!current || current.snapshotSequence >= receipt.acceptedSequence) return current;
            const knownTasks = new Set(current.tasks.map((task) => task.taskId));
            return {
              ...current,
              tasks: [
                ...current.tasks,
                ...taskIds
                  .filter((taskId) => !knownTasks.has(taskId))
                  .map((taskId) => ({
                    taskId,
                    requestId,
                    status: AUTHORING_TASK_STATUS.QUEUED,
                    errorCode: null,
                    outputId: null,
                  })),
              ],
            };
          },
        );
      }
      try {
        if (command.action === "sources.select" || command.action === "source.refresh") {
          await refreshAuthoringSession(courseId, sessionId);
        }
        await queryClient.invalidateQueries({ queryKey: authoringSessionsKey(courseId) });
        await queryClient.invalidateQueries({
          queryKey: [INFINITE_COURSE_AUTHORING_SESSIONS_QUERY_KEY, courseId],
        });
      } catch {
        // The command was accepted; a failed read must not invite a duplicate submission.
        await queryClient.invalidateQueries({ queryKey: authoringSessionKey(courseId, sessionId) });
      }
    },
    onError: async (error) => {
      if (!sessionId || !isAxiosError(error) || error.response?.status !== 409) return;
      try {
        await refreshAuthoringSession(courseId, sessionId);
      } catch {
        await queryClient.invalidateQueries({ queryKey: authoringSessionKey(courseId, sessionId) });
      }
    },
  });
