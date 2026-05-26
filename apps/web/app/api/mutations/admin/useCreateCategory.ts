import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { CreateCategoryBody } from "../../generated-api";

type CreateCategoryOptions = {
  data: CreateCategoryBody;
};

export function useCreateCategory() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateCategoryOptions) => {
      const response = await ApiClient.api.categoryControllerCreateCategory(options.data);

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      toast({
        variant: "default",
        description: t("adminCategoryView.toast.categoryCreatedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCategoryView.toast.categoryNotCreated"),
        ),
        variant: "destructive",
      });
    },
  });
}
