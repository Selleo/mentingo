import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

export function useInitializeLessonContext() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.lessonControllerInitializeLessonContext();

      return response.data.data;
    },
    onError: () => {
      toast({ description: t("common.toast.somethingWentWrong") });
    },
  });
}
