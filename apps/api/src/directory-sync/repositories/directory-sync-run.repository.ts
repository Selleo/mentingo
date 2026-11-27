import { Inject, Injectable } from "@nestjs/common";
import { DIRECTORY_SYNC_RUN_STATUSES } from "@repo/shared";
import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { directorySyncRuns } from "src/storage/schema";

import { DIRECTORY_SYNC_UNFINISHED_RUN_STATUSES } from "../directory-sync.constants";

export type DirectorySyncRun = typeof directorySyncRuns.$inferSelect;
export type DirectorySyncRunInsert = typeof directorySyncRuns.$inferInsert;
export type DirectorySyncRunUpdate = Partial<
  Omit<DirectorySyncRunInsert, "id" | "tenantId" | "connectionId" | "trigger" | "createdAt">
>;

@Injectable()
export class DirectorySyncRunRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async insertRun(values: DirectorySyncRunInsert) {
    const [run] = await this.db.insert(directorySyncRuns).values(values).returning();

    return run;
  }

  async updateRun(runId: UUIDType, values: DirectorySyncRunUpdate) {
    const [run] = await this.db
      .update(directorySyncRuns)
      .set(values)
      .where(eq(directorySyncRuns.id, runId))
      .returning();

    return run ?? null;
  }

  async findRunById(runId: UUIDType) {
    const [run] = await this.db
      .select()
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.id, runId))
      .limit(1);

    return run ?? null;
  }

  async findUnfinishedRunForConnection(connectionId: UUIDType) {
    const [run] = await this.db
      .select()
      .from(directorySyncRuns)
      .where(
        and(
          eq(directorySyncRuns.connectionId, connectionId),
          inArray(directorySyncRuns.status, DIRECTORY_SYNC_UNFINISHED_RUN_STATUSES),
        ),
      )
      .limit(1);

    return run ?? null;
  }

  async findLatestRunForConnection(connectionId: UUIDType) {
    const [run] = await this.db
      .select()
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.connectionId, connectionId))
      .orderBy(desc(directorySyncRuns.createdAt))
      .limit(1);

    return run ?? null;
  }

  async findRunsForConnection(
    connectionId: UUIDType,
    pagination: { limit: number; offset: number },
  ) {
    return this.db
      .select()
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.connectionId, connectionId))
      .orderBy(desc(directorySyncRuns.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);
  }

  async countRunsForConnection(connectionId: UUIDType) {
    const [{ runCount }] = await this.db
      .select({ runCount: count() })
      .from(directorySyncRuns)
      .where(eq(directorySyncRuns.connectionId, connectionId));

    return runCount;
  }

  /**
   * Queued runs go stale by creation time; running runs by their last heartbeat (updatedAt),
   * so a long but healthy run is not closed while a worker is still writing it.
   */
  async markStaleUnfinishedRunsAsFailed(staleBefore: string) {
    return this.db
      .update(directorySyncRuns)
      .set({
        status: DIRECTORY_SYNC_RUN_STATUSES.FAILED,
        finishedAt: new Date().toISOString(),
      })
      .where(
        or(
          and(
            eq(directorySyncRuns.status, DIRECTORY_SYNC_RUN_STATUSES.QUEUED),
            lt(directorySyncRuns.createdAt, staleBefore),
          ),
          and(
            eq(directorySyncRuns.status, DIRECTORY_SYNC_RUN_STATUSES.RUNNING),
            lt(directorySyncRuns.updatedAt, staleBefore),
          ),
        ),
      )
      .returning({ id: directorySyncRuns.id });
  }

  /** Writes only while the run is still unfinished, so a run closed as stale is never reopened. */
  async updateUnfinishedRun(runId: UUIDType, values: DirectorySyncRunUpdate) {
    const [run] = await this.db
      .update(directorySyncRuns)
      .set(values)
      .where(
        and(
          eq(directorySyncRuns.id, runId),
          inArray(directorySyncRuns.status, DIRECTORY_SYNC_UNFINISHED_RUN_STATUSES),
        ),
      )
      .returning();

    return run ?? null;
  }

  /** Returns false when the run was closed as stale or deleted with its connection. */
  async touchRunningRun(runId: UUIDType) {
    const touchedRuns = await this.db
      .update(directorySyncRuns)
      .set({ updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(directorySyncRuns.id, runId),
          eq(directorySyncRuns.status, DIRECTORY_SYNC_RUN_STATUSES.RUNNING),
        ),
      )
      .returning({ id: directorySyncRuns.id });

    return touchedRuns.length > 0;
  }
}
