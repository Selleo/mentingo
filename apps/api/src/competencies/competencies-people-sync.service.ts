import { Injectable } from "@nestjs/common";

import { dbAls } from "src/storage/db/db-als.store";

import { CompetenciesClientService } from "./competencies-client.service";
import {
  COMPETENCIES_PEOPLE_SYNC_BATCH_SIZE,
  COMPETENCIES_PEOPLE_SYNC_INTERVAL_MS,
} from "./competencies.constants";
import { CompetenciesContextRepository } from "./repositories/competencies-context.repository";

/**
 * Keeps the plugin's copy of people (names and active status) current, so it can search, filter and
 * paginate people lists itself. The plugin ignores snapshots that are not newer than what it stores.
 */
@Injectable()
export class CompetenciesPeopleSyncService {
  private readonly lastSyncByTenant = new Map<string, number>();

  constructor(
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly competenciesContextRepository: CompetenciesContextRepository,
  ) {}

  /** Sends every person to the plugin, at most once per interval for each tenant. */
  async syncTenantPeopleIfStale() {
    const tenantId = dbAls.getStore()?.tenantId;
    if (!tenantId) return;
    const lastSync = this.lastSyncByTenant.get(tenantId) ?? 0;
    if (Date.now() - lastSync < COMPETENCIES_PEOPLE_SYNC_INTERVAL_MS) return;
    await this.syncPeople(await this.competenciesContextRepository.findPeopleSnapshots());
    this.lastSyncByTenant.set(tenantId, Date.now());
  }

  /** Sends the given people right away, used when a command refers to someone just created. */
  async syncSubjectPeople(subjectIds: string[]) {
    if (!subjectIds.length) return;
    await this.syncPeople(
      await this.competenciesContextRepository.findPeopleSnapshots([...new Set(subjectIds)]),
    );
  }

  private async syncPeople(
    people: Awaited<ReturnType<CompetenciesContextRepository["findPeopleSnapshots"]>>,
  ) {
    await this.competenciesClientService.requestWithClient(async (client) => {
      for (let offset = 0; offset < people.length; offset += COMPETENCIES_PEOPLE_SYNC_BATCH_SIZE)
        await client.syncPeople(people.slice(offset, offset + COMPETENCIES_PEOPLE_SYNC_BATCH_SIZE));
    });
  }
}
