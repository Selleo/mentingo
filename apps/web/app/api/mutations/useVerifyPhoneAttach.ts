import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { VerifyAttachCodeBody } from "../generated-api";

export function useVerifyPhoneAttach() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: VerifyAttachCodeBody) => {
      const response = await ApiClient.api.userPhoneControllerVerifyAttachCode(data);

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(currentUserQueryOptions);
      toast({ description: t("phoneAuth.toast.phoneVerified") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phoneAuth.error.generic")),
      });
    },
  });
}
