import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const useDeleteCourse = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => await ApiClient.api.courseControllerDeleteCourse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course"] });
    },
    onError: (error) => {
      if (error instanceof Error) {
        console.error("Error deleting course:", error.message);
      } else {
        console.error("An unexpected error occurred while deleting the course.");
      }
    },
  });
};
