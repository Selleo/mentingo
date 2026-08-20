import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useUpdateFeaturedCourse() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (featuredCourseId: string | null) => {
      const response = await ApiClient.api.settingsControllerUpdateFeaturedCourse({
        featuredCourseId,
      });

      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries(globalSettingsQueryOptions);
      toast({ description: t("studentCoursesView.modernView.featuredCourse.updated") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("studentCoursesView.modernView.featuredCourse.updateFailed"),
        ),
      });
    },
  });
}
