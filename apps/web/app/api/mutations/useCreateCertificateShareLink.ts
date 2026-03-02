import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

type CreateCertificateShareLinkPayload = {
  certificateId: string;
  language: SupportedLanguages;
};

type CreateCertificateShareLinkResponse = {
  shareUrl: string;
  linkedinShareUrl: string;
};

export function useCreateCertificateShareLink() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (
      payload: CreateCertificateShareLinkPayload,
    ): Promise<CreateCertificateShareLinkResponse> => {
      const response = await ApiClient.instance.post<CreateCertificateShareLinkResponse>(
        "/api/certificates/share-link",
        payload,
      );

      return response.data;
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        toast({
          variant: "destructive",
          description:
            error.response?.data?.message || t("studentCertificateView.informations.shareFailed"),
        });
        return;
      }

      toast({
        variant: "destructive",
        description: t("studentCertificateView.informations.shareFailed"),
      });
    },
  });
}
