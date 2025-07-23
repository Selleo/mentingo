import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";
import { useCurrentUserSuspense } from "../queries/useCurrentUser";
import { userSettingsQueryOptions } from "../queries/useUserSettings";

import type { ChangeLanguageBody } from "../generated-api";
import type { Language } from "~/modules/Dashboard/Settings/Language/LanguageStore";
type ChangeLanguageOptions = {
  data: ChangeLanguageBody;
};

export function useChangeLanguage() {
  const { data: currentUser } = useCurrentUserSuspense();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setLanguage } = useLanguageStore();

  return useMutation({
    mutationFn: async (options: ChangeLanguageOptions) => {
      const response = await ApiClient.api.settingsControllerChangeLanguage(
        { id: currentUser.id },
        options.data,
      );

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: userSettingsQueryOptions.queryKey,
      });

      if (data?.data?.settings?.language) {
        setLanguage(data.data.settings.language as Language);
      }
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
