import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { LoginBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type LoginUserOptions = {
  data: LoginBody;
};

export function useLoginUser() {
  const { t } = useTranslation();
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
      handleAuthSuccess({ user: data, setLoggedIn, setCurrentUser, setHasVerifiedMFA });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({
        variant: "destructive",
        description: t(message),
      });
    },
  });
}
