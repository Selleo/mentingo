import { COMPETENCIES_MAX_SCOPE_SUBJECTS } from "@mentingo/competencies-sdk";
import { Injectable } from "@nestjs/common";

import { LearningFactsRepository } from "src/integration/repositories/learning-facts.repository";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CompetenciesClientService } from "./competencies-client.service";

import type { CompetenciesJobData } from "./competencies.types";

@Injectable()
export class CompetenciesSyncService {
  constructor(
    private readonly learningFactsRepository: LearningFactsRepository,
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}
  async enqueue(tenantId: string, subjectId: string, courseId: string, eventId?: string) {
    if (!(await this.competenciesClientService.isConfigured())) return;
    const jobId = `sync-${tenantId}-${subjectId}-${courseId}${eventId ? `-${eventId}` : ""}`;
    const existing = await this.queueService.getQueue(QUEUE_NAMES.COMPETENCIES).getJob(jobId);
    if (existing && (await existing.getState()) === "failed") {
      try {
        await existing.remove();
      } catch {
        if ((await existing.getState()) === "active") return existing;
        throw new Error("Failed competency job could not be replaced safely");
      }
      return this.queueService.enqueue<CompetenciesJobData>(
        QUEUE_NAMES.COMPETENCIES,
        existing.name,
        existing.data,
        { ...existing.opts, jobId: existing.id, attempts: 8 },
      );
    }
    return this.queueService.enqueue<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      "sync",
      { operation: "sync", tenantId, subjectId, courseId },
      {
        jobId,
        priority: 10,
        attempts: 8,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }
  async synchronize(subjectId: string, courseId: string) {
    if (!(await this.competenciesClientService.isConfigured())) return;
    return this.competenciesClientService.run(async (client) => {
      if (!(await client.configuration()).capabilities.competencies.enabled) return;
      const snapshot = await this.learningFactsRepository.snapshot(subjectId, courseId);
      return client.reconcileFacts(snapshot);
    });
  }
  async refreshSubjects(subjectIds: string[]) {
    if (!subjectIds.length) return;
    const subjects = [...new Set(subjectIds)];
    await this.competenciesClientService.run(async (client) => {
      const known: { subjectId: string; courseId: string }[] = [];
      for (let offset = 0; offset < subjects.length; offset += COMPETENCIES_MAX_SCOPE_SUBJECTS) {
        const batch = subjects.slice(offset, offset + COMPETENCIES_MAX_SCOPE_SUBJECTS);
        let cursor: string | undefined;
        const seen = new Set<string>();
        do {
          const page = await client.factScopes(cursor, batch);
          known.push(...page.pairs.filter((pair) => batch.includes(pair.subjectId)));
          cursor = page.nextCursor ?? undefined;
          if (cursor && seen.has(cursor)) throw new Error("Repeated learning scope cursor");
          if (cursor) seen.add(cursor);
        } while (cursor);
      }
      const pairs = [
        ...new Map(
          [...known, ...(await this.learningFactsRepository.sourcePairs(subjectIds))].map(
            (pair) => [`${pair.subjectId}:${pair.courseId}`, pair],
          ),
        ).values(),
      ];
      for (let offset = 0; offset < pairs.length; offset += 8) {
        await Promise.all(
          pairs
            .slice(offset, offset + 8)
            .map(async (pair) =>
              client.reconcileFacts(
                await this.learningFactsRepository.snapshot(pair.subjectId, pair.courseId),
              ),
            ),
        );
      }
    });
  }
  async enqueueCurrent(
    subjectId: string,
    courseId: string,
    tenantId = dbAls.getStore()?.tenantId,
    eventId?: string,
  ) {
    if (!tenantId) return;
    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await this.enqueue(tenantId, subjectId, courseId, eventId);
    });
  }
  async enqueueSubject(tenantId: string, subjectId: string, eventId?: string) {
    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      for (const pair of await this.learningFactsRepository.sourcePairs([subjectId]))
        await this.enqueue(tenantId, subjectId, pair.courseId, eventId);
    });
  }
}
