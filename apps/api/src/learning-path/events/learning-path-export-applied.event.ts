import { LearningPathCourseSyncEvent } from "src/events";
import { OutboxEvent } from "src/outbox/outbox.decorators";

import { learningPathExportAppliedEventSchema } from "../learning-path.schema";

/** Reconcile recipient enrollments only after the shared path transaction commits. */
@OutboxEvent({
  clearPayloadAfterDelivery: true,
  payloadSchema: learningPathExportAppliedEventSchema,
})
export class LearningPathExportAppliedEvent extends LearningPathCourseSyncEvent {}
