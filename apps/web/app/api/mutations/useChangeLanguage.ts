import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";
import { userSettingsQueryOptions } from "../queries/useUserSettings";

import type { UpdateUserSettingsBody } from "../generated-api";
import type { Language } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export function useChangeLanguage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setLanguage } = useLanguageStore();

  return useMutation({
    mutationFn: async (options: UpdateUserSettingsBody) => {
      const response = await ApiClient.api.settingsControllerUpdateUserSettings(options);

      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: userSettingsQueryOptions.queryKey,
      });

      if (data && "language" in data && data.language) {
        setLanguage(data.language as Language);
      }
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data?.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
