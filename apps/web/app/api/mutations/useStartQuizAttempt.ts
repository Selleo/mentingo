import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

import type { StartQuizAttemptBody } from "~/api/generated-api";

export function useStartQuizAttempt() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (body: StartQuizAttemptBody) =>
      (await ApiClient.api.lessonControllerStartQuizAttempt(body)).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["lesson"] });
      await queryClient.invalidateQueries({ queryKey: ["lessonProgress"] });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      }),
  });
}
