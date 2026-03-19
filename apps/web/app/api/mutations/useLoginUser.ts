import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { userSettingsQueryOptions } from "../queries/useUserSettings";
import { queryClient } from "../queryClient";

import { mfaSetupQueryOptions } from "./useSetupMFA";

import type { LoginBody } from "../generated-api";

type LoginUserOptions = {
  data: LoginBody;
};

export function useLoginUser() {
  const { toast } = useToast();
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore((state) => state.setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  return useMutation({
    mutationFn: async (options: LoginUserOptions) => {
      const response = await ApiClient.api.authControllerLogin(options.data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      const { shouldVerifyMFA } = data;
      const normalizedUser = { ...data, isSupportMode: false, studentModeCourseIds: [] };

      queryClient.setQueryData(currentUserQueryOptions.queryKey, { data: normalizedUser });
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(userSettingsQueryOptions);
      queryClient.invalidateQueries(mfaSetupQueryOptions);

      setLoggedIn(true);
      setCurrentUser(normalizedUser);
      setHasVerifiedMFA(!shouldVerifyMFA);
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
