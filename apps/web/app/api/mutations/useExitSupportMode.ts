import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

export function useExitSupportMode() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data } = await ApiClient.api.authControllerExitSupportMode();
      return data;
    },
    onSuccess: ({ data }) => {
      window.location.assign(data.redirectUrl);
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
