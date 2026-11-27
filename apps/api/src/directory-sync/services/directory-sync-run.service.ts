import { BadRequestException, ConflictException, Injectable, Logger } from "@nestjs/common";
import {
  DIRECTORY_SYNC_ERROR_KEYS,
  DIRECTORY_SYNC_RUN_STATUSES,
  DIRECTORY_SYNC_RUN_TRIGGERS,
  type DirectorySyncRunTrigger,
} from "@repo/shared";

import { DIRECTORY_SYNC_STALE_RUN_AFTER_MILLISECONDS } from "../directory-sync.constants";
import { DirectorySyncConnectionRepository } from "../repositories/directory-sync-connection.repository";
import { DirectorySyncRunRepository } from "../repositories/directory-sync-run.repository";
import { isConnectionSyncable } from "../utils/is-connection-syncable";
import { isUnfinishedDirectorySyncRunConflict } from "../utils/is-unfinished-directory-sync-run-conflict";

import { DirectorySyncQueueService } from "./directory-sync-queue.service";

import type { UUIDType } from "src/common";

@Injectable()
export class DirectorySyncRunService {
  private readonly logger = new Logger(DirectorySyncRunService.name);

  constructor(
    private readonly directorySyncConnectionRepository: DirectorySyncConnectionRepository,
    private readonly directorySyncRunRepository: DirectorySyncRunRepository,
    private readonly directorySyncQueueService: DirectorySyncQueueService,
  ) {}

  async requestManualDirectorySync(connectionId: UUIDType, triggeredByUserId: UUIDType) {
    await this.failStaleDirectorySyncRuns();

    const queuedRun = await this.queueDirectorySyncRun(
      connectionId,
      DIRECTORY_SYNC_RUN_TRIGGERS.MANUAL,
      triggeredByUserId,
    );

    if (!queuedRun) {
      throw new ConflictException(DIRECTORY_SYNC_ERROR_KEYS.SYNC_ALREADY_IN_PROGRESS);
    }

    return queuedRun;
  }

  /** Returns null when a sync for the connection is already queued or running. */
  async requestScheduledDirectorySync(connectionId: UUIDType) {
    return this.queueDirectorySyncRun(connectionId, DIRECTORY_SYNC_RUN_TRIGGERS.SCHEDULE, null);
  }

  /**
   * A run left queued or running by a crashed worker would block the connection forever,
   * so runs without progress for longer than the stale threshold are closed as failed.
   */
  async failStaleDirectorySyncRuns() {
    const staleBefore = new Date(
      Date.now() - DIRECTORY_SYNC_STALE_RUN_AFTER_MILLISECONDS,
    ).toISOString();
    const failedRuns =
      await this.directorySyncRunRepository.markStaleUnfinishedRunsAsFailed(staleBefore);

    if (failedRuns.length) {
      this.logger.warn(`Marked ${failedRuns.length} stale directory sync runs as failed`);
    }
  }

  private async queueDirectorySyncRun(
    connectionId: UUIDType,
    trigger: DirectorySyncRunTrigger,
    triggeredByUserId: UUIDType | null,
  ) {
    const connection =
      await this.directorySyncConnectionRepository.findConnectionById(connectionId);

    if (!connection || !isConnectionSyncable(connection)) {
      throw new BadRequestException(DIRECTORY_SYNC_ERROR_KEYS.CONNECTION_NOT_ACTIVE);
    }

    const queuedRun = await this.directorySyncRunRepository
      .insertRun({
        connectionId,
        trigger,
        triggeredByUserId,
        status: DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
      })
      .catch((error: unknown) => {
        if (isUnfinishedDirectorySyncRunConflict(error)) return null;
        throw error;
      });

    if (!queuedRun) return null;

    await this.directorySyncQueueService.enqueueDirectorySyncJob({
      tenantId: queuedRun.tenantId,
      runId: queuedRun.id,
    });

    return queuedRun;
  }
}
