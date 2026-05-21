import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { CATEGORY_QUERY_KEY } from "../../queries/admin/useCategoryById";

import type { SupportedLanguages } from "@repo/shared";

type AddCategoryLanguageOptions = {
  id: string;
  language: SupportedLanguages;
};

export function useAddCategoryLanguage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, language }: AddCategoryLanguageOptions) => {
      const response = await ApiClient.api.categoryControllerCreateLanguage(id, { language });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CATEGORY_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
