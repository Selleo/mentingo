/** Uploads a source through the generated authoring endpoint and refreshes the session. */
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { uploadAuthoringSource } from "../../modules/CourseAuthoring/courseAuthoring.api";
import { refreshAuthoringSession } from "../queries/useCourseAuthoringSessionQuery";

import type { SupportedLanguages } from "@repo/shared";

type Options = {
  courseId: string;
  language: SupportedLanguages;
  sessionId?: string;
  onUploaded?: (sourceVersionId: string) => void | Promise<void>;
};

/** React Query mutation for source upload, evidence selection, and session refresh. */
export const useUploadCourseAuthoringSource = ({
  courseId,
  sessionId,
  onUploaded,
}: Options) => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (file: File) => {
      if (!sessionId) {
        throw new Error("AUTHORING_SESSION_NOT_READY");
      }

      return uploadAuthoringSource(courseId, sessionId, file);
    },
    onSuccess: async (result) => {
      await onUploaded?.(result.sourceVersionId);
      toast({ description: t("courseAuthoring.activityRail.sourceUploaded") });

      if (sessionId) {
        await refreshAuthoringSession(courseId, sessionId);
      }
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("courseAuthoring.errors.sourceUploadFailed"),
        ),
      });
    },
  });
};
