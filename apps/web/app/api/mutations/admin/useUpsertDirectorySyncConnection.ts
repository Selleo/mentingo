import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { DIRECTORY_SYNC_CONNECTION_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { DirectorySyncProvider } from "@repo/shared";
import type { UpsertDirectorySyncConnectionBody } from "~/api/generated-api";

type UpsertDirectorySyncConnectionVariables = {
  provider: DirectorySyncProvider;
  connectionSettings: UpsertDirectorySyncConnectionBody;
};

export function useUpsertDirectorySyncConnection() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      provider,
      connectionSettings,
    }: UpsertDirectorySyncConnectionVariables) => {
      const response = await ApiClient.api.directorySyncControllerUpsertDirectorySyncConnection(
        provider,
        connectionSettings,
      );

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_CONNECTION_QUERY_KEY] });
      toast({ description: t("directorySync.toast.saveSuccess") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("directorySync.toast.saveError")),
      });
    },
  });
}
