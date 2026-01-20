import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type DeleteCourseTrailerOptions = {
  courseId: string;
};

export const useDeleteCourseTrailer = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ courseId }: DeleteCourseTrailerOptions) => {
      const response = await ApiClient.api.courseControllerDeleteCourseTrailer(courseId);
      return response.data;
    },
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      queryClient.invalidateQueries({ queryKey: ["course"] });
      toast({ description: t("adminCourseView.toast.courseTrailerRemovedSuccessfully") });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });
};
