import { useMutation } from "@tanstack/react-query";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";

import { ApiClient } from "../../api-client";

import type { CompleteScormImportResponse } from "~/api/generated-api";

export function useCompleteScormImport() {
  return useMutation({
    mutationFn: async (packageId: string): Promise<CompleteScormImportResponse["data"]> => {
      const response = await ApiClient.api.scormControllerCompleteScormImport(packageId);

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });
    },
  });
}
