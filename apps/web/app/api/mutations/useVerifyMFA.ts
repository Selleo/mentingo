import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

export function useVerifyMFA() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await ApiClient.api.authControllerMfaVerify({ token });
      if (!response.data.data.isValid) throw new Error(t("auth.error.invalidMfaCode"));
      return response.data;
    },
    onSuccess: async () => {
      await handleAuthSuccess();
      toast({ description: t("mfa.verify.toast.success") });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, "auth.error.invalidMfaCode"),
        variant: "destructive",
      });
    },
  });
}
