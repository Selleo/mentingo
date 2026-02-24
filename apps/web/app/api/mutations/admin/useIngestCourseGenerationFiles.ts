import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getCourseGenerationFilesQueryKey } from "~/api/queries/admin/useCourseGenerationFiles";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { IngestCourseGenerationFilesBody } from "~/api/generated-api";
import type { ApiErrorResponse } from "~/api/types";

type IngestCourseGenerationFilesOptions = {
  integrationId: string;
  files: File[];
};

export function useIngestCourseGenerationFiles() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: IngestCourseGenerationFilesOptions) => {
      const formData = new FormData();
      options.files.forEach((file) => formData.append("files", file));
      formData.append("integrationId", options.integrationId);

      const response = await ApiClient.api.lumaControllerIngestCourseGenerationFiles(
        {
          integrationId: options.integrationId,
          files: options.files,
        } as unknown as IngestCourseGenerationFilesBody,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          transformRequest: () => formData,
        },
      );

      return response.data;
    },
    onSuccess: async (_data, options) => {
      await queryClient.invalidateQueries({
        queryKey: getCourseGenerationFilesQueryKey(options.integrationId),
      });
      toast({
        description: t(
          "adminCourseView.curriculum.lesson.toast.courseGenerationFileAddedToUploadQueue",
        ),
      });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;
      toast({ description: t(message), variant: "destructive" });
    },
  });
}
