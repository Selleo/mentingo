import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";

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

  const navigate = useNavigate();
  const getLastEntry = useNavigationHistoryStore((state) => state.getLastEntry);
  const mergeNavigationHistory = useNavigationHistoryStore((state) => state.mergeNavigationHistory);

  mergeNavigationHistory();
  const lastEntry = getLastEntry();

  return useMutation({
    mutationFn: async (options: LoginUserOptions) => {
      const response = await ApiClient.api.authControllerLogin(options.data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      const { shouldVerifyMFA } = data;

      queryClient.setQueryData(currentUserQueryOptions.queryKey, { data });
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(userSettingsQueryOptions);
      queryClient.invalidateQueries(mfaSetupQueryOptions);

      console.log("Redirecting to:", lastEntry?.pathname || LOGIN_REDIRECT_URL);

      navigate(shouldVerifyMFA ? "/auth/mfa" : lastEntry?.pathname || LOGIN_REDIRECT_URL);
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
