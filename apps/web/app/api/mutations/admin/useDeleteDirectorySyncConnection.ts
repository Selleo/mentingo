import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { DIRECTORY_SYNC_CONNECTION_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncConnection";
import { DIRECTORY_SYNC_RUNS_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncRuns";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { DirectorySyncProvider } from "@repo/shared";

export function useDeleteDirectorySyncConnection() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (provider: DirectorySyncProvider) => {
      await ApiClient.api.directorySyncControllerDeleteDirectorySyncConnection(provider);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_CONNECTION_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_RUNS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast({ description: t("directorySync.toast.disconnectSuccess") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("directorySync.toast.disconnectError"),
        ),
      });
    },
  });
}
