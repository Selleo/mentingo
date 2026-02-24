import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import {
  COURSE_GENERATION_DRAFT_QUERY_KEY,
  getCourseGenerationDraftQueryKey,
} from "~/api/queries/admin/useCourseGenerationDraft";
import { getCourseGenerationMessagesQueryKey } from "~/api/queries/admin/useCourseGenerationMessages";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { SaveCourseGenerationBody } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

type SaveGeneratedCourseOptions = {
  integrationId: string;
  draftName?: string;
};

export function useSaveGeneratedCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: SaveGeneratedCourseOptions) => {
      const response = await ApiClient.api.lumaControllerSaveCourseGeneration({
        integrationId: options.integrationId,
      } as SaveCourseGenerationBody);

      return response.data;
    },
    onSuccess: async (_data, options) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] }),
        queryClient.invalidateQueries({ queryKey: ["course"] }),
        queryClient.invalidateQueries({
          queryKey: getCourseGenerationMessagesQueryKey(options.integrationId),
        }),
        queryClient.invalidateQueries({ queryKey: [COURSE_GENERATION_DRAFT_QUERY_KEY] }),
      ]);

      if (options.draftName) {
        await queryClient.invalidateQueries({
          queryKey: getCourseGenerationDraftQueryKey(options.integrationId, options.draftName),
        });
      }

      toast({
        description: t("adminCourseView.toast.courseGeneratedSavedSuccessfully"),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
