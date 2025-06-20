import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => await ApiClient.api.categoryControllerDeleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category"] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting category:", error.message);
      } else {
        console.error("An unexpected error occurred while deleting the category.");
      }
    },
  });
};
