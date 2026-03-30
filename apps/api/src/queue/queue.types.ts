import type { UUIDType } from "src/common";

export const QUEUE_NAMES = {
  DOCUMENT_INGESTION: "document-ingestion",
  LEARNING_TIME: "learning-time",
  MASTER_COURSE_EXPORT: "master-course-export",
  MASTER_COURSE_SYNC: "master-course-sync",
  AUDIO: "audio",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface LearningTimeJobData {
  userId: string;
  lessonId: string;
  courseId: string;
  tenantId?: string;
  secondsToAdd: number;
  timestamp: number;
}

export interface DocumentIngestionJobData {
  tenantId: UUIDType;
  lessonId: UUIDType;
  file: Express.Multer.File;
}

export interface MasterCourseExportJobData {
  sourceCourseId: string;
  sourceTenantId: string;
  targetTenantId: string;
  actorId: string;
}

export interface MasterCourseSyncJobData {
  exportId: string;
  sourceCourseId: string;
  sourceTenantId: string;
  targetTenantId: string;
  triggerEventType: string;
}
