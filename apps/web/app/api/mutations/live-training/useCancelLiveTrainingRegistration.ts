import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { toast } from "~/components/ui/use-toast";

export function useCancelLiveTrainingRegistration() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.liveTrainingControllerCancelRegistration(id)).data.data,
    onSuccess: async () => {
      await Promise.all([
        invalidateLiveTrainingData({ includeCoursesAndLessons: true }),
        queryClient.invalidateQueries({ queryKey: ["live-training-registrations"] }),
      ]);
      toast({ description: t("liveTrainingView.registration.saved") });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      }),
  });
}
