/** Persists the Core actor binding, event cursor, and replayable context requests. */
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { courseAuthoringContextBindings, courseAuthoringContextRequests } from "src/storage/schema";

import type {
  CourseAuthoringContextBinding,
  CourseAuthoringContextRequest,
  PendingCourseAuthoringContextRequest,
} from "./course-authoring-context-bridge.types";
import type { UUIDType } from "src/common";

@Injectable()
export class CourseAuthoringContextBridgeRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async bind(input: Omit<CourseAuthoringContextBinding, "id">) {
    await this.db
      .insert(courseAuthoringContextBindings)
      .values(input)
      .onConflictDoNothing({
        target: [courseAuthoringContextBindings.tenantId, courseAuthoringContextBindings.sessionId],
      });
    const [binding] = await this.db
      .select()
      .from(courseAuthoringContextBindings)
      .where(
        and(
          eq(courseAuthoringContextBindings.tenantId, input.tenantId),
          eq(courseAuthoringContextBindings.sessionId, input.sessionId),
        ),
      );
    if (
      !binding ||
      binding.courseId !== input.courseId ||
      binding.actorId !== input.actorId ||
      binding.language !== input.language
    )
      throw new ConflictException("courseAuthoring.errors.contextBindingConflict");
    return binding as CourseAuthoringContextBinding;
  }

  async pollableBindings(tenantId: UUIDType, limit: number) {
    return this.db
      .select()
      .from(courseAuthoringContextBindings)
      .where(eq(courseAuthoringContextBindings.tenantId, tenantId))
      .orderBy(asc(courseAuthoringContextBindings.updatedAt))
      .limit(limit) as Promise<CourseAuthoringContextBinding[]>;
  }

  async touchPollTime(tenantId: UUIDType, bindingId: UUIDType) {
    await this.db
      .update(courseAuthoringContextBindings)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(
        and(
          eq(courseAuthoringContextBindings.tenantId, tenantId),
          eq(courseAuthoringContextBindings.id, bindingId),
        ),
      );
  }

  async persistRealtimeRequest(
    tenantId: UUIDType,
    input: {
      eventId: UUIDType;
      sequence: number;
      request: CourseAuthoringContextRequest;
    },
  ) {
    const [binding] = await this.db
      .select()
      .from(courseAuthoringContextBindings)
      .where(
        and(
          eq(courseAuthoringContextBindings.tenantId, tenantId),
          eq(courseAuthoringContextBindings.sessionId, input.request.sessionId),
        ),
      );
    if (!binding) return undefined;
    if (binding.courseId !== input.request.courseId || binding.language !== input.request.language)
      throw new ConflictException("courseAuthoring.errors.contextBindingConflict");
    await this.db
      .insert(courseAuthoringContextRequests)
      .values({
        tenantId,
        bindingId: binding.id,
        eventId: input.eventId,
        sequence: input.sequence,
        contextRequestId: input.request.contextRequestId,
        requestId: input.request.requestId,
        taskId: input.request.taskId,
        taskFence: input.request.taskFence,
        payload: input.request,
      })
      .onConflictDoNothing({
        target: [
          courseAuthoringContextRequests.tenantId,
          courseAuthoringContextRequests.contextRequestId,
        ],
      });
    return binding;
  }

  /** Atomically records request events and advances the cursor past the fetched page. */
  async persistPage(
    binding: CourseAuthoringContextBinding,
    expectedCursor: number,
    nextSequence: number,
    requests: Array<{
      eventId: UUIDType;
      sequence: number;
      request: CourseAuthoringContextRequest;
    }>,
  ) {
    await this.db.transaction(async (tx) => {
      const [current] = await tx
        .select({ cursorSequence: courseAuthoringContextBindings.cursorSequence })
        .from(courseAuthoringContextBindings)
        .where(
          and(
            eq(courseAuthoringContextBindings.tenantId, binding.tenantId),
            eq(courseAuthoringContextBindings.id, binding.id),
          ),
        )
        .for("update");
      if (!current || current.cursorSequence !== expectedCursor) return;

      for (const item of requests) {
        const request = item.request;
        await tx
          .insert(courseAuthoringContextRequests)
          .values({
            tenantId: binding.tenantId,
            bindingId: binding.id,
            eventId: item.eventId,
            sequence: item.sequence,
            contextRequestId: request.contextRequestId,
            requestId: request.requestId,
            taskId: request.taskId,
            taskFence: request.taskFence,
            payload: request,
          })
          .onConflictDoNothing();
      }

      await tx
        .update(courseAuthoringContextBindings)
        .set({ cursorSequence: nextSequence })
        .where(
          and(
            eq(courseAuthoringContextBindings.tenantId, binding.tenantId),
            eq(courseAuthoringContextBindings.id, binding.id),
            eq(courseAuthoringContextBindings.cursorSequence, expectedCursor),
          ),
        );
    });
  }

  async pending(
    tenantId: UUIDType,
    limit: number,
  ): Promise<PendingCourseAuthoringContextRequest[]> {
    return this.db
      .select({
        contextRequestId: courseAuthoringContextRequests.contextRequestId,
        bindingId: courseAuthoringContextRequests.bindingId,
        sessionId: courseAuthoringContextBindings.sessionId,
        tenantId: courseAuthoringContextRequests.tenantId,
      })
      .from(courseAuthoringContextRequests)
      .innerJoin(
        courseAuthoringContextBindings,
        eq(courseAuthoringContextBindings.id, courseAuthoringContextRequests.bindingId),
      )
      .where(
        and(
          eq(courseAuthoringContextRequests.tenantId, tenantId),
          eq(courseAuthoringContextRequests.status, "pending"),
        ),
      )
      .orderBy(asc(courseAuthoringContextRequests.createdAt))
      .limit(limit);
  }

  async findRequest(tenantId: UUIDType, contextRequestId: UUIDType) {
    const [row] = await this.db
      .select({
        request: courseAuthoringContextRequests,
        binding: courseAuthoringContextBindings,
      })
      .from(courseAuthoringContextRequests)
      .innerJoin(
        courseAuthoringContextBindings,
        eq(courseAuthoringContextBindings.id, courseAuthoringContextRequests.bindingId),
      )
      .where(
        and(
          eq(courseAuthoringContextRequests.tenantId, tenantId),
          eq(courseAuthoringContextRequests.contextRequestId, contextRequestId),
        ),
      );
    return row;
  }

  async markFulfilled(tenantId: UUIDType, contextRequestId: UUIDType) {
    await this.db
      .update(courseAuthoringContextRequests)
      .set({ status: "fulfilled", fulfilledAt: sql`CURRENT_TIMESTAMP`, failureCode: null })
      .where(
        and(
          eq(courseAuthoringContextRequests.tenantId, tenantId),
          eq(courseAuthoringContextRequests.contextRequestId, contextRequestId),
          eq(courseAuthoringContextRequests.status, "pending"),
        ),
      );
  }

  async markFailed(tenantId: UUIDType, contextRequestId: UUIDType, failureCode: string) {
    await this.db
      .update(courseAuthoringContextRequests)
      .set({ status: "failed", failureCode })
      .where(
        and(
          eq(courseAuthoringContextRequests.tenantId, tenantId),
          eq(courseAuthoringContextRequests.contextRequestId, contextRequestId),
          eq(courseAuthoringContextRequests.status, "pending"),
        ),
      );
  }
}
