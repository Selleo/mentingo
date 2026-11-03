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
import { CertificateArchivedEmailEvent } from "src/events/certificate/certificate-archived-email.event";
import { LearningSourceWithdrawnEvent } from "src/events/learning/learning-source-withdrawn.event";
import { LessonCompletedEvent } from "src/events/lesson/lesson-completed.event";
import { LessonProgressChangedEvent } from "src/events/lesson/lesson-progress-changed.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { LearningPathExportAppliedEvent } from "src/learning-path/events/learning-path-export-applied.event";
import { NativeArchiveImportFinishedEvent } from "src/native-archive/events/native-archive-import-finished.event";

/**
 * Events handled by direct intake. A failed one is retried only after a short backoff, and one
 * left processing by a crashed worker is returned to pending by stalled-intake recovery.
 */
export const OUTBOX_DIRECT_HANDLER_EVENT_TYPES = [
  NotificationEvent.name,
  CertificateArchivedEmailEvent.name,
  LearningSourceWithdrawnEvent.name,
  LessonCompletedEvent.name,
  LessonProgressChangedEvent.name,
  UserCourseFinishedEvent.name,

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
