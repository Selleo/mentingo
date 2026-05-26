import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { categoryByIdQueryOptions } from "~/api/queries/admin/useCategoryById";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateCategoryBody } from "../../generated-api";

type UpdateCategoryOptions = {
  data: UpdateCategoryBody;
  categoryId: string;
};

export function useUpdateCategory() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateCategoryOptions) => {
      const response = await ApiClient.api.categoryControllerUpdateCategory(
        options.categoryId,
        options.data,
      );

      return response.data;
    },
    onSuccess: async (_data, { categoryId, data: { language } }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY }),
        queryClient.invalidateQueries(categoryByIdQueryOptions(categoryId, language)),
      ]);
      toast({ description: t("adminCategoryView.toast.categoryUpdatedSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
