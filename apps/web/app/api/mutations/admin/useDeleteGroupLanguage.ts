import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateLearningPathEnrollmentData } from "~/api/utils/invalidateLearningPathEnrollmentData";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";

type DeleteGroupLanguageInput = {
  groupId: string;
  language: SupportedLanguages;
};

export function useDeleteGroupLanguage() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ groupId, language }: DeleteGroupLanguageInput) => {
      const response = await ApiClient.api.groupControllerDeleteLanguage(groupId, { language });

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [GROUPS_QUERY_KEY] });
      await invalidateLearningPathEnrollmentData();

      toast({ description: t("adminGroupsView.language.languageDeleted") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
