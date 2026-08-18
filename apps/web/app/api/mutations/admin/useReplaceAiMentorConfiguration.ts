import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AI_MENTOR_CONFIGURATION_QUERY_KEY } from "~/api/queries/admin/useAiMentorConfiguration";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { ReplaceAiMentorConfigurationBody } from "~/api/generated-api";

type ReplaceAiMentorConfigurationOptions = {
  lessonId: string;
  data: ReplaceAiMentorConfigurationBody;
};

export const useReplaceAiMentorConfiguration = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ lessonId, data }: ReplaceAiMentorConfigurationOptions) => {
      const response =
        await ApiClient.api.aiMentorConfigurationControllerReplaceAiMentorConfiguration(
          lessonId,
          data,
        );
      return response.data.data;
    },
    onSuccess: async (_configuration, { lessonId }) => {
      await queryClient.invalidateQueries({
        queryKey: [...AI_MENTOR_CONFIGURATION_QUERY_KEY, lessonId],
      });
      toast({
        description: t(
          "adminCourseView.curriculum.lesson.aiMentorConfiguration.configurationSaved",
        ),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
};
