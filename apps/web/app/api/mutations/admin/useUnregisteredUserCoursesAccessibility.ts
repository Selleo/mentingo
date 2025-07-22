import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { userSettingsQueryOptions } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

export function useUnregisteredUserCoursesAccessibility() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async () => {
      const { data } =
        await ApiClient.api.settingsControllerUpdateUnregisteredUserCoursesAccessibility();
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(userSettingsQueryOptions);
      toast({
        variant: "default",
        description: t("adminPreferences.toast.coursesAccessibilityPreferenceChangeSuccess"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
