import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CALENDAR_EVENTS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEvents";
import { googleCalendarConnectionQueryOptions } from "~/api/queries/calendar/useGoogleCalendarConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useSyncGoogleCalendar() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      await ApiClient.api.googleCalendarControllerSyncGoogleCalendar();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: googleCalendarConnectionQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_QUERY_KEY }),
      ]);
      toast({ description: t("googleCalendar.toast.syncQueued") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("googleCalendar.toast.syncFailed")),
      });
    },
  });
}
