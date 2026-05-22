import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CALENDAR_EVENTS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEvents";
import { LIVE_TRAINING_QUERY_KEY } from "~/api/queries/live-training/useLiveTraining";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";

type DeleteLiveTrainingOptions = {
  id: string;
};

export function useDeleteLiveTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id }: DeleteLiveTrainingOptions) => {
      const response = await ApiClient.api.liveTrainingControllerDeleteLiveTraining(id);

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LIVE_TRAINING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_QUERY_KEY }),
      ]);

      toast({
        variant: "default",
        description: t("liveTrainingView.deleteDialog.toast.success"),
      });
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
