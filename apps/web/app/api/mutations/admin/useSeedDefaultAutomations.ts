import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export interface SeedDefaultsResponse {
  created: number;
  skipped: number;
  total: number;
}

/**
 * Seeds default automations for the current tenant.
 * Skips automations whose trigger type already exists.
 * Sends the current UI language so labels are generated in the user's language.
 *
 * Backend endpoint: POST /api/automations/seed-defaults
 */
export function useSeedDefaultAutomations() {
  const { toast } = useToast();
  const { t, i18n } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const language = i18n.language || "en";
      const { data } = await ApiClient.instance.post<{ data: SeedDefaultsResponse }>(
        "/api/automations/seed-defaults",
        { language },
      );
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return data.data;
    },

    onSuccess: (result) => {
      toast({
        variant: "default",
        description: t("automationView.seedDefaults.toasts.success", {
          created: result.created,
          skipped: result.skipped,
        }),
      });
    },

    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("automationView.seedDefaults.toasts.error"),
        ),
      });
    },
  });
}
