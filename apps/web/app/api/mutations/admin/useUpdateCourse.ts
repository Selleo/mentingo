import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateCourseBody } from "../../generated-api";
import type { AxiosError } from "axios";

type UpdateCourseOptions = {
  data: UpdateCourseBody;
  courseId: string;
};

const COURSE_LIST_QUERY_KEYS = [
  ALL_COURSES_QUERY_KEY,
  ["available-courses"],
  ["content-creator-courses"],
  ["get-student-courses"],
  ["top-courses"],
] as const;

export function useUpdateCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateCourseOptions) => {
      const response = await ApiClient.api.courseControllerUpdateCourse(
        options.courseId,
        options.data,
      );

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id: options.courseId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["course"],
        }),
        ...COURSE_LIST_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]);

      return response.data;
    },
    onSuccess: () => {
      toast({ description: t("adminCourseView.toast.courseUpdatedSuccessfully") });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as { message: string };

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
