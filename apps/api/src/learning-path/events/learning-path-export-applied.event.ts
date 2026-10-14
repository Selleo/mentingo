import { LearningPathCourseSyncEvent } from "src/events";

/** Reconcile recipient enrollments only after the shared path transaction commits. */
export class LearningPathExportAppliedEvent extends LearningPathCourseSyncEvent {}
