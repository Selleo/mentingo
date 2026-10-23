import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { assistantMessagesKey } from "~/api/queries/assistant/useAssistantMessages";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useCancelAssistantRun(threadId: string) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (runId: string) =>
      (await ApiClient.api.assistantControllerCancelRun(threadId, runId)).data.data,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantMessagesKey(threadId) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId) }),
      ]);
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      }),
  });
}
