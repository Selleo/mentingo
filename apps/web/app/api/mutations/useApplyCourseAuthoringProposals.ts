/** Prepares an explicit proposal and optional-asset selection for native application. */
import { useMutation } from "@tanstack/react-query";

import { applyAuthoringProposals } from "../../modules/CourseAuthoring/courseAuthoring.api";

type ApplyInput = {
  proposalIds: string[];
  acknowledgeAssessmentChanges: boolean;
  omitOptionalAssetIds: string[];
  commandId: string;
};

type Options = {
  courseId: string;
  sessionId?: string;
  onPreparing?: () => void;
  onSuccess?: (result: Awaited<ReturnType<typeof applyAuthoringProposals>>) => void;
  onError?: (error: unknown) => void;
};

/** React Query mutation for explicit proposal and asset apply selections. */
export const useApplyCourseAuthoringProposals = ({
  courseId,
  sessionId,
  onPreparing,
  onSuccess,
  onError,
}: Options) =>
  useMutation({
    mutationFn: (input: ApplyInput) => {
      if (!sessionId) {
        throw new Error("AUTHORING_SESSION_NOT_READY");
      }

      onPreparing?.();

      return applyAuthoringProposals(
        courseId,
        sessionId,
        input.proposalIds,
        input.acknowledgeAssessmentChanges,
        input.commandId,
        input.omitOptionalAssetIds,
      );
    },
    onSuccess,
    onError,
  });
