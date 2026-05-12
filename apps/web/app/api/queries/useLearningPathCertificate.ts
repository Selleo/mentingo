import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetCertificateResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";
import type { CertificateType } from "~/types/certificate";

type LearningPathCertificateQueryParams = {
  userId?: string;
  learningPathId?: string;
  language?: SupportedLanguages;
};

export const learningPathCertificateQueryOptions = (
  params: LearningPathCertificateQueryParams,
) => ({
  queryKey: [
    "learning-path-certificate",
    params.userId,
    params.learningPathId,
    { language: params.language },
  ],
  enabled: !!params.userId && !!params.learningPathId,
  queryFn: async () => {
    const response = await ApiClient.api.learningPathCertificateControllerGetCertificate({
      userId: params.userId,
      learningPathId: params.learningPathId!,
      language: params.language,
    });
    return response.data;
  },
  select: (data: GetCertificateResponse): CertificateType | null => data,
});

export function useLearningPathCertificate(params: LearningPathCertificateQueryParams) {
  return useQuery(learningPathCertificateQueryOptions(params));
}
