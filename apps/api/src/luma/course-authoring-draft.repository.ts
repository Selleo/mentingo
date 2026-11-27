/** Stores private pre-course session ownership, activity and the one-time native course binding. */
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, asc, eq, gt, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { courseAuthoringDrafts } from "src/storage/schema";

import type {
  CourseAuthoringDraftIdentity,
  CourseAuthoringInactiveDraftCursor,
} from "./course-authoring.types";

@Injectable()
export class CourseAuthoringDraftRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  /** Returns the same placeholder for concurrent retries of one owner's creation command. */
  async open(identity: { tenantId: string; ownerId: string; creationCommandId: string }) {
    const [created] = await this.db
      .insert(courseAuthoringDrafts)
      .values(identity)
      .onConflictDoNothing({
        target: [
          courseAuthoringDrafts.tenantId,
          courseAuthoringDrafts.ownerId,
          courseAuthoringDrafts.creationCommandId,
        ],
      })
      .returning();
    if (created) return created;
    const [existing] = await this.db
      .select()
      .from(courseAuthoringDrafts)
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, identity.tenantId),
          eq(courseAuthoringDrafts.ownerId, identity.ownerId),
          eq(courseAuthoringDrafts.creationCommandId, identity.creationCommandId),
        ),
      );
    if (!existing) throw new ConflictException("courseAuthoring.errors.applicationFailed");
    return existing;
  }

  /** Locates the session by its tenant-scoped placeholder; callers enforce owner access. */
  async find(tenantId: string, placeholderCourseId: string) {
    const [draft] = await this.db
      .select()
      .from(courseAuthoringDrafts)
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
        ),
      );
    return draft ?? null;
  }

  /** Attaches the first Luma session ID and permits retries only for that same ID. */
  async bindSession(tenantId: string, placeholderCourseId: string, sessionId: string) {
    const [draft] = await this.db
      .update(courseAuthoringDrafts)
      .set({ lumaSessionId: sessionId, lastActivityAt: sql`now()` })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
          isNull(courseAuthoringDrafts.expiredAt),
          or(
            isNull(courseAuthoringDrafts.lumaSessionId),
            eq(courseAuthoringDrafts.lumaSessionId, sessionId),
          ),
        ),
      )
      .returning();
    if (!draft) throw new ConflictException("courseAuthoring.errors.invalidSession");
    return draft;
  }

  /** Extends a live ephemeral session without resurrecting expired drafts. */
  async touch(tenantId: string, placeholderCourseId: string, sessionId: string) {
    const [draft] = await this.db
      .update(courseAuthoringDrafts)
      .set({ lastActivityAt: sql`now()` })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
          eq(courseAuthoringDrafts.lumaSessionId, sessionId),
          isNull(courseAuthoringDrafts.expiredAt),
        ),
      )
      .returning();
    return draft ?? null;
  }

  /** Serializes creation against other exports and expiration within the application transaction. */
  async lockForCreation(identity: CourseAuthoringDraftIdentity, transaction: DatabasePg) {
    const [draft] = await transaction
      .select()
      .from(courseAuthoringDrafts)
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, identity.tenantId),
          eq(courseAuthoringDrafts.id, identity.placeholderCourseId),
          eq(courseAuthoringDrafts.lumaSessionId, identity.sessionId),
          eq(courseAuthoringDrafts.ownerId, identity.ownerId),
          isNull(courseAuthoringDrafts.expiredAt),
        ),
      )
      .for("update");
    if (!draft) throw new NotFoundException("courseAuthoring.errors.sessionNotFound");
    if (draft.courseId)
      throw new ConflictException("courseAuthoring.errors.selectionAlreadyApplied");
  }

  /** Records the native course identity under the previously acquired draft lock. */
  async attachCourse(identity: CourseAuthoringDraftIdentity, courseId: string, db: DatabasePg) {
    const [attached] = await db
      .update(courseAuthoringDrafts)
      .set({ courseId })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, identity.tenantId),
          eq(courseAuthoringDrafts.id, identity.placeholderCourseId),
          eq(courseAuthoringDrafts.lumaSessionId, identity.sessionId),
          eq(courseAuthoringDrafts.ownerId, identity.ownerId),
          isNull(courseAuthoringDrafts.courseId),
          isNull(courseAuthoringDrafts.expiredAt),
        ),
      )
      .returning({ id: courseAuthoringDrafts.id });
    if (!attached) throw new ConflictException("courseAuthoring.errors.selectionAlreadyApplied");
  }

  /** Lists a fair, bounded batch for durable autonomous event replay. */
  async pollable(tenantId: string, limit: number) {
    return this.db
      .select()
      .from(courseAuthoringDrafts)
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          isNotNull(courseAuthoringDrafts.lumaSessionId),
          isNull(courseAuthoringDrafts.courseId),
          isNull(courseAuthoringDrafts.expiredAt),
        ),
      )
      .orderBy(asc(courseAuthoringDrafts.lastPolledAt), asc(courseAuthoringDrafts.id))
      .limit(limit);
  }

  /** Advances only the cursor that was read by this poller. */
  async markPolled(tenantId: string, placeholderCourseId: string, from: number, through: number) {
    await this.db
      .update(courseAuthoringDrafts)
      .set({ cursorSequence: through, lastPolledAt: sql`now()` })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
          eq(courseAuthoringDrafts.cursorSequence, from),
        ),
      );
  }

  /** Pages candidates by keyset so drafts whose cleanup keeps failing cannot hide later ones. */
  async inactive(
    tenantId: string,
    before: Date,
    after: CourseAuthoringInactiveDraftCursor | null,
    limit: number,
  ) {
    return this.db
      .select()
      .from(courseAuthoringDrafts)
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          isNull(courseAuthoringDrafts.courseId),
          isNull(courseAuthoringDrafts.discardedAt),
          lt(courseAuthoringDrafts.lastActivityAt, before.toISOString()),
          after
            ? or(
                gt(courseAuthoringDrafts.lastActivityAt, after.lastActivityAt),
                and(
                  eq(courseAuthoringDrafts.lastActivityAt, after.lastActivityAt),
                  gt(courseAuthoringDrafts.id, after.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(asc(courseAuthoringDrafts.lastActivityAt), asc(courseAuthoringDrafts.id))
      .limit(limit);
  }

  /** Fences inactivity against a new owner heartbeat or the transaction that attaches a course. */
  async expire(tenantId: string, placeholderCourseId: string, before: Date) {
    const [draft] = await this.db
      .update(courseAuthoringDrafts)
      .set({ expiredAt: sql`coalesce(${courseAuthoringDrafts.expiredAt}, now())` })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
          isNull(courseAuthoringDrafts.courseId),
          isNull(courseAuthoringDrafts.discardedAt),
          lt(courseAuthoringDrafts.lastActivityAt, before.toISOString()),
        ),
      )
      .returning();
    return draft ?? null;
  }

  /** Retires acknowledged Luma discards from sweep retries. */
  async markDiscarded(tenantId: string, placeholderCourseId: string) {
    await this.db
      .update(courseAuthoringDrafts)
      .set({ discardedAt: sql`now()` })
      .where(
        and(
          eq(courseAuthoringDrafts.tenantId, tenantId),
          eq(courseAuthoringDrafts.id, placeholderCourseId),
          isNull(courseAuthoringDrafts.courseId),
          isNotNull(courseAuthoringDrafts.expiredAt),
        ),
      );
  }
}
