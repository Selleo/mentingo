import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getCourseGenerationFilesQueryKey } from "~/api/queries/admin/useCourseGenerationFiles";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

type DeleteCourseGenerationFileOptions = {
  integrationId: string;
  documentId: string;
};

export function useDeleteCourseGenerationFile() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: DeleteCourseGenerationFileOptions) => {
      const response = await ApiClient.api.lumaControllerDeleteIngestedCourseGenerationFile(
        options.integrationId,
        options.documentId,
      );
      return response.data;
    },
    onSuccess: async (_data, options) => {
      await queryClient.invalidateQueries({
        queryKey: getCourseGenerationFilesQueryKey(options.integrationId),
      });
      toast({
        description: t(
          "adminCourseView.curriculum.lesson.toast.aiMentorLessonFileDeletedSuccessfully",
        ),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
