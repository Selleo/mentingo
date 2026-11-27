import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { isQueueSandboxProcess } from "src/queue/queue.constants";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import {
  DIRECTORY_SYNC_SCHEDULE_CRON_EXPRESSION,
  DIRECTORY_SYNC_SYNCABLE_CONNECTION_STATUSES,
} from "../directory-sync.constants";
import { DirectorySyncConnectionRepository } from "../repositories/directory-sync-connection.repository";
import { DirectorySyncRunService } from "../services/directory-sync-run.service";
import { isConnectionScheduled } from "../utils/is-connection-scheduled";

@Injectable()
export class DirectorySyncCron {
  private readonly logger = new Logger(DirectorySyncCron.name);

  constructor(
    private readonly tenantDbRunnerService: TenantDbRunnerService,
    private readonly directorySyncConnectionRepository: DirectorySyncConnectionRepository,
    private readonly directorySyncRunService: DirectorySyncRunService,
  ) {}

  @Cron(DIRECTORY_SYNC_SCHEDULE_CRON_EXPRESSION)
  async requestScheduledDirectorySyncs() {
    if (isQueueSandboxProcess()) return;

    await this.tenantDbRunnerService.runForEachTenant(async (tenantId) => {
      try {
        await this.directorySyncRunService.failStaleDirectorySyncRuns();

        const connections = await this.directorySyncConnectionRepository.findConnectionsByStatuses(
          DIRECTORY_SYNC_SYNCABLE_CONNECTION_STATUSES,
        );

        for (const connection of connections.filter(isConnectionScheduled)) {
          await this.directorySyncRunService.requestScheduledDirectorySync(connection.id);
        }
      } catch (error) {
        this.logger.error(`Failed to schedule directory sync for tenant ${tenantId}`, error);
      }
    });
  }
}
