import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { CATEGORIES_QUERY_KEY } from "~/api/queries/useCategories";

export const useDeleteManyCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryIds: string[]) =>
      await ApiClient.api.categoryControllerDeleteManyCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_QUERY_KEY });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting categories:", error.message);
      } else {
        console.error("An unexpected error occurred while deleting categories.");
      }
    },
  });
};
