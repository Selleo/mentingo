import {
  AutomationEmailDeliveryRequestedEvent,
  NotificationEvent,
} from "src/automation-execution/events/notification-event";
import { ContentMarketplaceCourseCopiedEvent } from "src/content-marketplace/events/content-marketplace-course-copied.event";
import { CourseTransferRequestedEvent } from "src/course-transfer/events/course-transfer-requested.event";
import { CourseTransferVideoMetadataRequestedEvent } from "src/course-transfer/events/course-transfer-video-metadata-requested.event";
import {
  BulkUpdateCourseCategoryEvent,
  CourseDuplicatedEvent,
  CreateChapterEvent,
  CreateLessonEvent,
  DeleteChapterEvent,
  DeleteLessonEvent,
  UpdateChapterEvent,
  UpdateCourseEvent,
  UpdateLessonEvent,
} from "src/events";
import { LearningPathExportAppliedEvent } from "src/learning-path/events/learning-path-export-applied.event";
import { NativeArchiveImportFinishedEvent } from "src/native-archive/events/native-archive-import-finished.event";

/**
 * Events handled by direct intake. A failed one is retried only after a short backoff, and one
 * left processing by a crashed worker is returned to pending by stalled-intake recovery.
 */
export const OUTBOX_DIRECT_HANDLER_EVENT_TYPES = [
  NotificationEvent.name,
  AutomationEmailDeliveryRequestedEvent.name,
  LearningPathExportAppliedEvent.name,
  CourseTransferRequestedEvent.name,
  CourseTransferVideoMetadataRequestedEvent.name,
  BulkUpdateCourseCategoryEvent.name,
  UpdateCourseEvent.name,
  CreateChapterEvent.name,
  UpdateChapterEvent.name,
  DeleteChapterEvent.name,
  CreateLessonEvent.name,
  UpdateLessonEvent.name,
  DeleteLessonEvent.name,
  NativeArchiveImportFinishedEvent.name,
  ContentMarketplaceCourseCopiedEvent.name,
  CourseDuplicatedEvent.name,
] as const;
