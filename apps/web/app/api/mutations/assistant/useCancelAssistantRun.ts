import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  captureAssistantSession,
  inAssistantSession,
  useAssistantScope,
  AssistantSessionChangedError,
} from "~/api/assistantIdentity";
import { assistantMessagesKey } from "~/api/queries/assistant/useAssistantMessages";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useCancelAssistantRun(threadId: string) {
  const { t } = useTranslation();
  const scope = useAssistantScope();
  return useMutation({
    onMutate: () => captureAssistantSession(scope),
    mutationFn: async (runId: string) =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerCancelRun(threadId, runId)).data.data,
      ),
    onSuccess: async (_result, _body, session) => {
      if (!session) throw new AssistantSessionChangedError();
      session.assertCurrent();
      const scope = session.scope;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantMessagesKey(threadId, scope) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId, scope) }),
      ]);
      session.assertCurrent();
    },
    onError: (error) => {
      if (error instanceof AssistantSessionChangedError) return;
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
