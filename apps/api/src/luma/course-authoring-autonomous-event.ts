/** Validates a producer's fenced apply request against a persisted Core binding. */
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { QUEUE_NAMES } from "src/queue";

import type { AuthoringEventsResponse } from "./schema/course-authoring-session.schema";
import type { QueueService } from "src/queue";
import type { CourseAuthoringAutonomousApplyJob } from "src/queue/queue.types";

const autonomousApplyRequestSchema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    sessionId: Type.String({ format: "uuid" }),
    courseId: Type.String({ format: "uuid" }),
    requestId: Type.String({ format: "uuid" }),
    actorId: Type.String({ format: "uuid" }),
    controlEpoch: Type.Integer({ minimum: 0 }),
    proposalIds: Type.Array(Type.String({ format: "uuid" }), {
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    }),
  },
  { additionalProperties: false },
);

/** A producer event that can never be handed off, unlike a transient queue failure. */
export class InvalidAutonomousApplyRequestError extends Error {}

/** Enqueues durably before a poller advances its cursor; the job ID deduplicates replay. */
export async function enqueueAuthoringAutonomousEvent(
  queueService: QueueService,
  binding: { tenantId: string; courseId: string; sessionId: string; ownerId?: string },
  event: AuthoringEventsResponse["events"][number],
) {
  if (event.type !== "autonomous.apply_requested") return;
  if (!Value.Check(autonomousApplyRequestSchema, event.payload))
    throw new InvalidAutonomousApplyRequestError("Invalid autonomous apply request");
  const { schemaVersion: _schemaVersion, ...request } = event.payload;
  if (
    event.sessionId !== binding.sessionId ||
    request.sessionId !== binding.sessionId ||
    request.courseId !== binding.courseId ||
    (binding.ownerId !== undefined && request.actorId !== binding.ownerId)
  )
    throw new InvalidAutonomousApplyRequestError(
      "Autonomous apply request does not match its Core binding",
    );
  await queueService.enqueue<CourseAuthoringAutonomousApplyJob>(
    QUEUE_NAMES.COURSE_AUTHORING_AUTONOMOUS,
    "apply-autonomous-request",
    { ...request, tenantId: binding.tenantId, eventId: event.eventId },
    {
      jobId: `autonomous-${binding.tenantId}-${event.eventId}`,
      attempts: 10,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 604800 },
      removeOnFail: false,
    },
  );
}
