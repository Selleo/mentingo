import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useUpdateAssistantThread(threadId: string) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (body: Parameters<typeof ApiClient.api.assistantControllerUpdateThread>[1]) =>
      (await ApiClient.api.assistantControllerUpdateThread(threadId, body)).data.data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadsKey }),
      ]);
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      }),
  });
}
