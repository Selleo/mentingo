import type { LearningPathRepository } from "../learning-path.repository";

export type LearningPathCertificateShareRecord = NonNullable<
  Awaited<ReturnType<LearningPathRepository["findPublicLearningPathCertificateById"]>>
>;

export type LearningPathCertificateRenderRecord = NonNullable<
  Awaited<ReturnType<LearningPathRepository["findLearningPathCertificateByIdForRender"]>>
>;
