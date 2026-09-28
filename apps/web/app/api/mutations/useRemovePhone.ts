import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { currentUserQueryOptions } from "../queries/useCurrentUser";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useRemovePhone() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.api.userPhoneControllerRemoveOwnPhone();

      return response.data.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(currentUserQueryOptions);
      toast({ description: t("phoneAuth.toast.phoneRemoved") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phoneAuth.error.generic")),
      });
    },
  });
}
