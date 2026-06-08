import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type HandleMagicLinkOptions = { token: string };

export function useHandleMagicLink() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore((state) => state.setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  return useMutation({
    mutationFn: async ({ token }: HandleMagicLinkOptions) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data } = await ApiClient.api.authControllerHandleMagicLink({
        token,
      });

      return data;
    },
    onSuccess: async ({ data }) => {
      await handleAuthSuccess({ user: data, setLoggedIn, setCurrentUser, setHasVerifiedMFA });
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
