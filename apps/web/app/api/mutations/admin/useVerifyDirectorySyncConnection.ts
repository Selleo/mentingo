import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { DIRECTORY_SYNC_CONNECTION_QUERY_KEY } from "~/api/queries/admin/useDirectorySyncConnection";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { DirectorySyncProvider } from "@repo/shared";

export function useVerifyDirectorySyncConnection() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (provider: DirectorySyncProvider) => {
      const response =
        await ApiClient.api.directorySyncControllerVerifyDirectorySyncConnection(provider);

      return response.data.data;
    },
    onSuccess: () => {
      toast({ description: t("directorySync.toast.verifySuccess") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("directorySync.toast.verifyError")),
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [DIRECTORY_SYNC_CONNECTION_QUERY_KEY] });
    },
  });
}
