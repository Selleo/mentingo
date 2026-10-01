import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

type EnrollCourseOptions = {
  id: string;
};

export function useEnrollCourse() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: EnrollCourseOptions) => {
      const response = await ApiClient.api.courseControllerEnrollCourse({
        id: options.id,
      });

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("studentCoursesView.other.successfullyEnrolledToCourse"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
