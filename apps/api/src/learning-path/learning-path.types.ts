import type { LearningPathCourseSchema, LearningPathSchema } from "./learning-path.schema";
import type {
  LearningPathCertificateStatus,
  LearningPathEntityType,
  LearningPathStatus,
  LocalizedText,
} from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { ProgressStatus } from "src/utils/types/progress.type";

export type ExistingLearningPath = LearningPathSchema;

export type LearningPathCourseProgressRow = {
  courseId: UUIDType;
  progress: ProgressStatus;
  completedAt: string | null;
};

export type LearningPathCourseLink = {
  id: UUIDType;
  learningPathId: UUIDType;
  courseId: UUIDType;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type LearningPathExportRecord = {
  id: UUIDType;
  sourceTenantId: UUIDType;
  sourceLearningPathId: UUIDType;
  targetTenantId: UUIDType;
  targetLearningPathId: UUIDType | null;
  syncStatus: string;
  lastSyncedAt: string | null;
};

export type LearningPathEntityMapRecord = {
  id: UUIDType;
  exportId: UUIDType;
  entityType: LearningPathEntityType;
  sourceEntityId: UUIDType;
  targetEntityId: UUIDType;
};

export type LearningPathCertificateRecord = {
  id: UUIDType;
  learningPathId: UUIDType;
  userId: UUIDType;
  status: LearningPathCertificateStatus;
  issuedAt: string;
  expiresAt: string | null;
  tenantId: UUIDType;
  createdAt: string;
  updatedAt: string;
};

export type LearningPathProgressState = {
  courses: LearningPathCourseSchema[];
  studentCourseProgressRows: LearningPathCourseProgressRow[];
  isEnrolled: boolean;
};

export type LearningPathSourceSnapshot = {
  learningPath: ExistingLearningPath;
  courseLinks: LearningPathCourseLink[];
};

export type LearningPathUpdateData = {
  title?: LocalizedText | SQL<unknown>;
  description?: LocalizedText | SQL<unknown>;
  thumbnailReference?: string | null;
  status?: LearningPathStatus;
  includesCertificate?: boolean;
  sequenceEnabled?: boolean;
};
