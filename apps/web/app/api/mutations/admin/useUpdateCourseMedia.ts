import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { invalidateCourseListData } from "~/api/utils/invalidateCourseListData";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { UpdateCourseMediaBody } from "../../generated-api";

type UpdateCourseMediaOptions = {
  courseId: string;
  data: UpdateCourseMediaBody;
};

export function useUpdateCourseMedia() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ courseId, data }: UpdateCourseMediaOptions) => {
      const response = await ApiClient.api.courseControllerUpdateCourseMedia(courseId, data);

      return response.data;
    },
    onSuccess: async (_data, { courseId }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: [COURSE_QUERY_KEY, { id: courseId }],
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
