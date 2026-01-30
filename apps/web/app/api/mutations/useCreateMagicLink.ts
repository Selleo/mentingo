import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { CreateMagicLinkBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type CreateMagicLinkOptions = {
  data: CreateMagicLinkBody;
};

export function useCreateMagicLink() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ data }: CreateMagicLinkOptions) => {
      return ApiClient.api.authControllerCreateMagicLink(data);
    },
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({ description: t(message), variant: "destructive" });
    },
  });
}
