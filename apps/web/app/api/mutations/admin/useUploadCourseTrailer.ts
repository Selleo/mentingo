import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type UploadCourseTrailerOptions = {
  courseId: string;
  file: File;
};

export const useUploadCourseTrailer = () => {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ courseId, file }: UploadCourseTrailerOptions) => {
      const formData = new FormData();
      formData.append("trailer", file);

      const response = await ApiClient.instance.request({
        url: `/api/course/${courseId}/trailer`,
        method: "PATCH",
        data: formData,
        headers: { "Content-Type": "multipart/form-data" },
      });

      return response.data as { data: { trailerUrl: string | null } };
    },
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({
        queryKey: [COURSE_QUERY_KEY, { id: courseId }],
      });
      queryClient.invalidateQueries({ queryKey: ["course"] });
      toast({ description: t("adminCourseView.toast.courseTrailerUpdatedSuccessfully") });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });
};
