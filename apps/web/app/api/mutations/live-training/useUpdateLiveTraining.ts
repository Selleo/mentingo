import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CALENDAR_EVENT_DETAILS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEventDetails";
import { CALENDAR_EVENTS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEvents";
import { LIVE_TRAINING_QUERY_KEY } from "~/api/queries/live-training/useLiveTraining";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { UpdateLiveTrainingBody } from "~/api/generated-api";

type UpdateLiveTrainingOptions = {
  id: string;
  data: UpdateLiveTrainingBody;
};

export function useUpdateLiveTraining() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateLiveTrainingOptions) => {
      const response = await ApiClient.api.liveTrainingControllerUpdateLiveTraining(id, data);

      return response.data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: LIVE_TRAINING_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_EVENT_DETAILS_QUERY_KEY }),
      ]);

      toast({
        variant: "default",
        description: t("liveTrainingView.edit.toast.success"),
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
