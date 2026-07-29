import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CALENDAR_EVENTS_QUERY_KEY } from "~/api/queries/calendar/useCalendarEvents";
import { microsoftCalendarConnectionQueryOptions } from "~/api/queries/calendar/useMicrosoftCalendarConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useDisconnectMicrosoftCalendar() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      await ApiClient.api.microsoftCalendarControllerDisconnect();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: microsoftCalendarConnectionQueryOptions.queryKey });
      queryClient.invalidateQueries({ queryKey: CALENDAR_EVENTS_QUERY_KEY });
      toast({ description: t("microsoftCalendar.toast.disconnected") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("microsoftCalendar.toast.disconnectFailed"),
        ),
      });
    },
  });
}
