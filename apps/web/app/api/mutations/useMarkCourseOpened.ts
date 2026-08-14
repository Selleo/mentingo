import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useMarkCourseOpened() {
  return useMutation({
    mutationFn: async (courseId: string) => {
      const response = await ApiClient.api.courseControllerMarkCourseOpened(courseId);
      return response.data;
    },
  });
}
