import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type HandleMagicLinkOptions = { token: string };

export function useHandleMagicLink() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ token }: HandleMagicLinkOptions) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const { data } = await ApiClient.api.authControllerHandleMagicLink({
        token,
      });

      return data;
    },
    onSuccess: handleAuthSuccess,
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
