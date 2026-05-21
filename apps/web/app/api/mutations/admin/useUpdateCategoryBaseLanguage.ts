import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { CATEGORY_QUERY_KEY } from "../../queries/admin/useCategoryById";

import type { SupportedLanguages } from "@repo/shared";

type UpdateCategoryBaseLanguageOptions = {
  id: string;
  baseLanguage: SupportedLanguages;
};

export function useUpdateCategoryBaseLanguage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, baseLanguage }: UpdateCategoryBaseLanguageOptions) => {
      const response = await ApiClient.api.categoryControllerUpdateBaseLanguage(id, {
        baseLanguage,
      });

      return response.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [...CATEGORY_QUERY_KEY, variables.id] });
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
      toast({ description: t("adminCategoryView.toast.baseLanguageUpdatedSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCategoryView.toast.baseLanguageUpdateFailed"),
        ),
        variant: "destructive",
      });
    },
  });
}
