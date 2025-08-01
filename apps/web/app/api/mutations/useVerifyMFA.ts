import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { useToast } from "~/components/ui/use-toast";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import { ApiClient } from "../api-client";

export function useVerifyMFA() {
  const { toast } = useToast();
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  return useMutation({
    mutationFn: async (token: string) => {
      const response = await ApiClient.api.authControllerMfaVerify({ token });

      return response.data;
    },
    onSuccess: () => {
      toast({
        description: "MFA verification successful.",
      });

      setHasVerifiedMFA(true);
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
