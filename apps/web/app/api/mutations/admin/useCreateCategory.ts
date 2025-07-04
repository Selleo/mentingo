import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";
import { queryClient } from "~/api/queryClient";
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

      await queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCategoryView.toast.categoryCreatedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
