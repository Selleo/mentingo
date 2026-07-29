import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { microsoftCalendarConnectionQueryOptions } from "~/api/queries/calendar/useMicrosoftCalendarConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useSetMicrosoftCalendarOutboundSync() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await ApiClient.api.microsoftCalendarControllerUpdateOutbound({
        enabled,
      });
      return response.data.data;
    },
    onSuccess: (result, enabled) => {
      queryClient.invalidateQueries({ queryKey: microsoftCalendarConnectionQueryOptions.queryKey });
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      toast({
        description: t(
          enabled
            ? "microsoftCalendar.toast.outboundEnabled"
            : "microsoftCalendar.toast.outboundDisabled",
        ),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("microsoftCalendar.toast.outboundFailed"),
        ),
      });
    },
  });
}
