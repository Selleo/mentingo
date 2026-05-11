import type { LearningPathCoursePreviewSchema } from "./learning-path.schema";
import type { LearningPathSettings } from "./types/learning-path-settings.types";
import type {
  LearningPathCertificateStatus,
  LearningPathEntityType,
  LearningPathStatus,
} from "@repo/shared";
import type { InferSelectModel, SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { learningPaths } from "src/storage/schema";
import type { ProgressStatus } from "src/utils/types/progress.type";

export type ExistingLearningPath = InferSelectModel<typeof learningPaths>;

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

export type LearningPathProgressCourseLink = LearningPathCourseLink & {
  title: string;
  description: string;
  thumbnailUrl: string | null;
  courseChapterCount: number;
};

export type LearningPathCoursePreviewGroup = {
  learningPathId: UUIDType;
  courses: LearningPathCoursePreviewSchema[];
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
  courses: LearningPathProgressCourseLink[];
  studentCourseProgressRows: LearningPathCourseProgressRow[];
  isEnrolled: boolean;
};

export type LearningPathSourceSnapshot = {
  learningPath: ExistingLearningPath;
  courseLinks: LearningPathCourseLink[];
};

export type LearningPathUpdateData = {
  title?: SQL<unknown>;
  description?: SQL<unknown>;
  thumbnailReference?: string | null;
  status?: LearningPathStatus;
  includesCertificate?: boolean;
  settings?: LearningPathSettings | SQL<unknown>;
  sequenceEnabled?: boolean;
  availableLocales?: ExistingLearningPath["availableLocales"];
};
