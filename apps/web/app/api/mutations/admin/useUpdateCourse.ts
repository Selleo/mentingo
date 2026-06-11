import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseListData } from "~/api/utils/invalidateCourseListData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateCourseBody } from "../../generated-api";

type UpdateCourseOptions = {
  data: UpdateCourseBody;
  courseId: string;
};

export function useUpdateCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: UpdateCourseOptions) => {
      const response = await ApiClient.api.courseControllerUpdateCourse(
        options.courseId,
        options.data,
      );

      return response.data;
    },
    onSuccess: async (_data, options) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id: options.courseId }],
        }),
        queryClient.invalidateQueries({
          queryKey: ["course"],
        }),
        invalidateCourseListData(),
      ]);

      toast({ description: t("adminCourseView.toast.courseUpdatedSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
        variant: "destructive",
      });
    },
  });
}
