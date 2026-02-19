export const QUEUE_NAMES = {
  DOCUMENT_INGESTION: "document-ingestion",
  LEARNING_TIME: "learning-time",
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
  file: Express.Multer.File;
  documentId: string;
  sha256: string;
}
