import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { googleCalendarConnectionQueryOptions } from "~/api/queries/calendar/useGoogleCalendarConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useSetGoogleCalendarOutboundSync() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await ApiClient.api.googleCalendarControllerUpdateGoogleCalendarOutboundSync(
        { enabled },
      );
      return response.data.data;
    },
    onSuccess: (result, enabled) => {
      queryClient.invalidateQueries({ queryKey: googleCalendarConnectionQueryOptions.queryKey });
      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
        return;
      }
      toast({
        description: t(
          enabled
            ? "googleCalendar.toast.outboundEnabled"
            : "googleCalendar.toast.outboundDisabled",
        ),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("googleCalendar.toast.outboundFailed"),
        ),
      });
    },
  });
}
