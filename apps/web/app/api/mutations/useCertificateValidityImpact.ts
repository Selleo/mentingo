import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { CertificateValiditySetting } from "@repo/shared";

type CertificateValidityImpactParams = {
  courseId: string;
  certificateValidity: CertificateValiditySetting;
};

export function useCertificateValidityImpact() {
  return useMutation({
    mutationFn: async ({ courseId, certificateValidity }: CertificateValidityImpactParams) => {
      const response = await ApiClient.api.certificatesControllerGetCertificateValidityImpact(
        courseId,
        { certificateValidity },
      );
      return response.data;
    },
  });
}
