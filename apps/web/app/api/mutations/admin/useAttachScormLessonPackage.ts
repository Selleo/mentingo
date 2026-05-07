import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";

type AttachScormLessonPackageOptions = {
  lessonId: string;
  data: Parameters<typeof ApiClient.api.scormControllerAttachScormLessonPackage>[1];
};

export function useAttachScormLessonPackage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: AttachScormLessonPackageOptions) => {
      const response = await ApiClient.api.scormControllerAttachScormLessonPackage(
        options.lessonId,
        options.data,
      );

      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });

      toast({ description: t(data.data.message) });
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("adminCourseView.curriculum.lesson.toast.unexpectedError"),
        ),
      });
    },
  });
}
