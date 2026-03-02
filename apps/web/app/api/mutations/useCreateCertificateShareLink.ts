import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type {
  CreateCertificateShareLinkBody,
  CreateCertificateShareLinkResponse,
} from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

export function useCreateCertificateShareLink() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (
      payload: CreateCertificateShareLinkBody,
    ): Promise<CreateCertificateShareLinkResponse> => {
      const { data } =
        await ApiClient.api.certificatesControllerCreateCertificateShareLink(payload);

      return data;
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data as ApiErrorResponse) ?? {};

      toast({
        variant: "destructive",
        description: t(message || "studentCertificateView.informations.shareFailed"),
      });
    },
  });
}
