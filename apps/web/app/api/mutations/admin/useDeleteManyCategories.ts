import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export const useDeleteManyCategories = () => {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (categoryIds: string[]) =>
      await ApiClient.api.categoryControllerDeleteManyCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      toast({
        title: t("adminCategoriesView.toast.deleteCategorySuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        title: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCategoriesView.toast.deleteCategoryFailed"),
        ),
        variant: "destructive",
      });
    },
  });
};
