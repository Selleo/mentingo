import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { BetaCreateChapterBody } from "~/api/generated-api";

type CreateChapterOptions = {
  data: BetaCreateChapterBody;
};

export function useBetaCreateChapter() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateChapterOptions) => {
      const response = await ApiClient.api.chapterControllerBetaCreateChapter(options.data);

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.chapter.toast.chapterCreatedSuccessfully"),
      });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string; count: number };
      toast({
        description: t(apiResponseData.message, { count: apiResponseData.count }),
        variant: "destructive",
      });
    },
  });
}
