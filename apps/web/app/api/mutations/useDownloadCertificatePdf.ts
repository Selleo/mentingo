import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { AxiosResponse } from "axios";
import type { DownloadCertificateBody } from "~/api/generated-api";

export function useDownloadCertificatePdf() {
  return useMutation({
    mutationFn: async (payload: DownloadCertificateBody): Promise<AxiosResponse> => {
      return await ApiClient.api.certificatesControllerDownloadCertificate(payload, {
        format: "blob",
      });
    },
  });
}
