import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { FORUM_QUERY_KEY } from "~/api/queries/forum/forumQueryKeys";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import type { CreateTopicBody } from "~/api/generated-api";

export function useCreateForumTopic() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  return useMutation({
    mutationFn: async (body: CreateTopicBody) => {
      const response = await ApiClient.api.forumControllerCreateTopic(body, { language });

      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: FORUM_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("forum.toast.createTopicError")),
      });
    },
  });
}
