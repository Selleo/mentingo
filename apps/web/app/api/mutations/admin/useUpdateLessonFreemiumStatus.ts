import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type UpdateLessonFreemiumStatusOptions = {
  data: { isFreemium: boolean };
  chapterId: string;
};

export function useUpdateLessonFreemiumStatus() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateLessonFreemiumStatusOptions) => {
      const response = await ApiClient.api.chapterControllerUpdateFreemiumStatus(
        { isFreemium: options.data.isFreemium },
        { chapterId: options.chapterId },
      );

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("adminCourseView.toast.courseUpdatedSuccessfully") });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("adminCourseView.curriculum.chapter.toast.errorWhileUpdating"),
          ),
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
