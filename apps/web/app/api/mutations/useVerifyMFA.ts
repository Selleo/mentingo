import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";

export function useVerifyMFA() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await ApiClient.api.authControllerMfaVerify({ token });

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: t("mfa.verify.toast.success"),
      });

      setHasVerifiedMFA(true);
    },
    onError: () => {
      toast({
        description: t("mfa.verify.toast.error"),
        variant: "destructive",
      });
    },
  });
}
