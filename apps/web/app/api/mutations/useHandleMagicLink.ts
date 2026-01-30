import { useNavigate } from "@remix-run/react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useAuthStore } from "~/modules/Auth/authStore";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { userSettingsQueryOptions } from "../queries/useUserSettings";
import { queryClient } from "../queryClient";

import { mfaSetupQueryOptions } from "./useSetupMFA";

import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type HandleMagicLinkOptions = { token: string };

export function useHandleMagicLink() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const navigate = useNavigate();

  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore((state) => state.setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);
  const getLastEntry = useNavigationHistoryStore((state) => state.getLastEntry);
  const mergeNavigationHistory = useNavigationHistoryStore((state) => state.mergeNavigationHistory);
  const cleanHistory = useNavigationHistoryStore((state) => state.clearHistory);

  return useMutation({
    mutationFn: async ({ token }: HandleMagicLinkOptions) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data } = await ApiClient.api.authControllerHandleMagicLink({
        token,
      });

      return data;
    },
    onSuccess: ({ data }) => {
      const { shouldVerifyMFA } = data;

      queryClient.setQueryData(currentUserQueryOptions.queryKey, { data });
      queryClient.invalidateQueries(currentUserQueryOptions);
      queryClient.invalidateQueries(userSettingsQueryOptions);
      queryClient.invalidateQueries(mfaSetupQueryOptions);

      setLoggedIn(true);
      setCurrentUser(data);
      setHasVerifiedMFA(!shouldVerifyMFA);

      mergeNavigationHistory();

      const lastEntry = getLastEntry();

      navigate(shouldVerifyMFA ? "/auth/mfa" : lastEntry?.pathname || LOGIN_REDIRECT_URL);

      cleanHistory();
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
