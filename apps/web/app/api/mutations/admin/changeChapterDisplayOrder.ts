import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type ChangeChapterDisplayOrderOptions = {
  chapter: { chapterId: string; displayOrder: number };
};

export function useChangeChapterDisplayOrder() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: ChangeChapterDisplayOrderOptions) => {
      const response = await ApiClient.api.chapterControllerUpdateChapterDisplayOrder(
        options.chapter,
      );

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t(
          "adminCourseView.curriculum.chapter.toast.chapterDisplayOrderUpdatedSuccessfully",
        ),
      });
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
        description: error.message || t("adminCourseView.curriculum.chapter.toast.unexpectedError"),
        variant: "destructive",
      });
    },
  });
}
