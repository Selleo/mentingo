import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { COURSE_QUERY_KEY } from "~/api/queries/admin/useBetaCourse";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

type CreateScormLessonOptions = {
  data: Parameters<typeof ApiClient.api.scormControllerCreateScormLesson>[0];
};

export function useCreateScormLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateScormLessonOptions) => {
      const response = await ApiClient.api.scormControllerCreateScormLesson(options.data);

      return response.data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: [COURSE_QUERY_KEY] });
      await queryClient.invalidateQueries({ queryKey: ["course"] });

      toast({ description: t(data.data.message) });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: getTranslatedApiErrorMessage(
            error,
            t,
            t("adminCourseView.curriculum.lesson.toast.unexpectedError"),
          ),
        });
      }

      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
