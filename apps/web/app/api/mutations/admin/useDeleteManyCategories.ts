import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const useDeleteManyCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryIds: string[]) =>
      await ApiClient.api.categoryControllerDeleteManyCategories(categoryIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category"] });
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
