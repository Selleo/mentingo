import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
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

      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("adminCategoryView.toast.categoryUpdatedSuccessfully") });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
