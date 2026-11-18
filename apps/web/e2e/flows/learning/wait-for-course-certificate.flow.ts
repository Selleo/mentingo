import { expect } from "@playwright/test";

import type { FixtureApiClient } from "../../utils/api-client";

export const getCourseCertificateIdFlow = async (
  apiClient: FixtureApiClient,
  { courseId, studentId }: { courseId: string; studentId: string },
) => {
  const response = await apiClient.api.certificatesControllerGetCertificate({
    courseId,
    language: "en",
    userId: studentId,
  });

  return response.data?.id ?? null;
};

export const waitForCourseCertificateFlow = async (
  apiClient: FixtureApiClient,
  input: { courseId: string; studentId: string },
): Promise<string> => {
  await expect
    .poll(() => getCourseCertificateIdFlow(apiClient, input), { timeout: 15_000 })
    .not.toBeNull();

  const certificateId = await getCourseCertificateIdFlow(apiClient, input);
  if (!certificateId) {
    throw new Error(`Certificate was not created for course ${input.courseId}`);
  }

  return certificateId;
};
