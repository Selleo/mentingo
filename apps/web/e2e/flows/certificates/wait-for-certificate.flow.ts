import { expect } from "@playwright/test";

import type { CertificateFactory } from "../../factories/certificate.factory";

export const waitForCertificateFlow = async (
  certificateFactory: CertificateFactory,
  input: { courseId: string; userId: string },
): Promise<string> => {
  const getCertificateId = async () => {
    const certificate = await certificateFactory.getForCourse(input);
    return certificate?.id ?? null;
  };

  await expect.poll(getCertificateId, { timeout: 15_000 }).not.toBeNull();

  const certificateId = await getCertificateId();
  if (!certificateId) {
    throw new Error(`Certificate was not created for course ${input.courseId}`);
  }

  return certificateId;
};

export const waitForLearningPathCertificateFlow = async (
  certificateFactory: CertificateFactory,
  input: { learningPathId: string; userId: string },
): Promise<string> => {
  const getCertificateId = async () => {
    const certificate = await certificateFactory.getForLearningPath(input);
    return certificate?.id ?? null;
  };

  await expect.poll(getCertificateId, { timeout: 30_000 }).not.toBeNull();

  const certificateId = await getCertificateId();
  if (!certificateId) {
    throw new Error(`Certificate was not created for learning path ${input.learningPathId}`);
  }

  return certificateId;
};
