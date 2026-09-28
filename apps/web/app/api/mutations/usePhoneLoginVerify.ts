import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { VerifyLoginCodeBody } from "../generated-api";

export function usePhoneLoginVerify() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore((state) => state.setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  return useMutation({
    mutationFn: async (data: VerifyLoginCodeBody) => {
      const response = await ApiClient.api.phoneAuthControllerVerifyLoginCode(data);

      return response.data;
    },
    onSuccess: async ({ data }) => {
      await handleAuthSuccess({ user: data, setLoggedIn, setCurrentUser, setHasVerifiedMFA });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phoneAuth.error.generic")),
      });
    },
  });
}
