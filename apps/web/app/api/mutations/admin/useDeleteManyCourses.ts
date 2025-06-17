import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const useDeleteManyCourses = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) =>
      await ApiClient.api.courseControllerDeleteManyCourses({ ids }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting courses:", error.message);
      } else {
        console.error("An unexpected error occurred while deleting the course.");
      }
    },
  });
};
