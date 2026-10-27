import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import {
  captureAssistantSession,
  inAssistantSession,
  useAssistantScope,
  AssistantSessionChangedError,
} from "~/api/assistantIdentity";
import { assistantThreadKey } from "~/api/queries/assistant/useAssistantThread";
import { assistantThreadsKey } from "~/api/queries/assistant/useAssistantThreads";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { toast } from "~/components/ui/use-toast";

export function useUpdateAssistantThread(threadId: string) {
  const { t } = useTranslation();
  const scope = useAssistantScope();
  return useMutation({
    onMutate: () => captureAssistantSession(scope),
    mutationFn: async (body: Parameters<typeof ApiClient.api.assistantControllerUpdateThread>[1]) =>
      inAssistantSession(
        scope,
        async () => (await ApiClient.api.assistantControllerUpdateThread(threadId, body)).data.data,
      ),
    onSuccess: async (_result, _body, session) => {
      if (!session) throw new AssistantSessionChangedError();
      session.assertCurrent();
      const scope = session.scope;
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assistantThreadKey(threadId, scope) }),
        queryClient.invalidateQueries({ queryKey: assistantThreadsKey(scope) }),
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
