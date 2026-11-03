import { COMPETENCIES_MAX_SCOPE_SUBJECTS } from "@mentingo/competencies-sdk";
import { Injectable } from "@nestjs/common";

import { LearningFactsRepository } from "src/integration/repositories/learning-facts.repository";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { CompetenciesClientService } from "./competencies-client.service";
import {
  COMPETENCIES_SYNC_JOB_OPTIONS,
  COMPETENCIES_SYNC_JOB_STATES,
  COMPETENCIES_JOB_OPERATIONS,
  COMPETENCIES_FACT_RECONCILE_CONCURRENCY,
} from "./competencies.constants";
import {
  deduplicateLearningScopes,
  getLearningFactsJobId,
} from "./utils/competencies-learning-scope.utils";

import type {
  CompetenciesClient,
  CompetenciesJobData,
  CompetenciesLearningScope,
} from "./competencies.types";
import type { Job } from "bullmq";

@Injectable()
export class CompetenciesSyncService {
  constructor(
    private readonly learningFactsRepository: LearningFactsRepository,
    private readonly competenciesClientService: CompetenciesClientService,
    private readonly queueService: QueueService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async enqueueCourseLearningFacts(
    tenantId: string,
    subjectId: string,
    courseId: string,
    eventId?: string,
  ) {
    if (!(await this.competenciesClientService.isConfigured())) return;
    const jobId = getLearningFactsJobId(tenantId, subjectId, courseId, eventId);
    const existingJob = await this.queueService.getQueue(QUEUE_NAMES.COMPETENCIES).getJob(jobId);
    if (existingJob && (await existingJob.getState()) === COMPETENCIES_SYNC_JOB_STATES.FAILED)
      return this.replaceFailedSyncJob(existingJob);

    return this.queueService.enqueue<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      COMPETENCIES_JOB_OPERATIONS.SYNC,
      { operation: COMPETENCIES_JOB_OPERATIONS.SYNC, tenantId, subjectId, courseId },
      { ...COMPETENCIES_SYNC_JOB_OPTIONS, jobId },
    );
  }

  async reconcileCourseLearningFacts(subjectId: string, courseId: string) {
    if (!(await this.competenciesClientService.isConfigured())) return;
    return this.competenciesClientService.requestWithClient(async (client) => {
      if (!(await client.configuration()).capabilities.competencies.enabled) return;
      const snapshot = await this.learningFactsRepository.snapshot(subjectId, courseId);
      return client.reconcileFacts(snapshot);
    });
  }

  async reconcileSubjectLearningFacts(subjectIds: string[]) {
    if (!subjectIds.length) return;
    const uniqueSubjectIds = [...new Set(subjectIds)];
    await this.competenciesClientService.requestWithClient(async (client) => {
      const knownScopes = await this.getKnownLearningScopes(client, uniqueSubjectIds);
      const sourceScopes = await this.learningFactsRepository.sourcePairs(uniqueSubjectIds);
      const scopes = deduplicateLearningScopes([...knownScopes, ...sourceScopes]);

      await this.reconcileLearningScopes(client, scopes);
    });
  }

  async enqueueCourseLearningFactsForCurrentTenant(
    subjectId: string,
    courseId: string,
    tenantId = dbAls.getStore()?.tenantId,
    eventId?: string,
  ) {
    if (!tenantId) return;
    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      await this.enqueueCourseLearningFacts(tenantId, subjectId, courseId, eventId);
    });
  }

  async enqueueSubjectLearningFacts(tenantId: string, subjectId: string, eventId?: string) {
    await this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      for (const pair of await this.learningFactsRepository.sourcePairs([subjectId]))
        await this.enqueueCourseLearningFacts(tenantId, subjectId, pair.courseId, eventId);
    });
  }

  private async replaceFailedSyncJob(job: Job<CompetenciesJobData>) {
    try {
      await job.remove();
    } catch {
      if ((await job.getState()) === COMPETENCIES_SYNC_JOB_STATES.ACTIVE) return job;
      throw new Error("Failed competency job could not be replaced safely");
    }

    return this.queueService.enqueue<CompetenciesJobData>(
      QUEUE_NAMES.COMPETENCIES,
      job.name,
      job.data,
      { ...job.opts, jobId: job.id, attempts: COMPETENCIES_SYNC_JOB_OPTIONS.attempts },
    );
  }

  private async getKnownLearningScopes(
    client: CompetenciesClient,
    subjectIds: string[],
  ): Promise<CompetenciesLearningScope[]> {
    const scopes: CompetenciesLearningScope[] = [];

    for (let offset = 0; offset < subjectIds.length; offset += COMPETENCIES_MAX_SCOPE_SUBJECTS) {
      const subjectBatch = subjectIds.slice(offset, offset + COMPETENCIES_MAX_SCOPE_SUBJECTS);
      const batchScopes = await this.getLearningScopePages(client, subjectBatch);
      scopes.push(...batchScopes);
    }

    return scopes;
  }

  private async getLearningScopePages(
    client: CompetenciesClient,
    subjectIds: string[],
  ): Promise<CompetenciesLearningScope[]> {
    const scopes: CompetenciesLearningScope[] = [];
    const requestedSubjectIds = new Set(subjectIds);
    const visitedCursors = new Set<string>();
    let cursor: string | undefined;

    do {
      const page = await client.factScopes(cursor, subjectIds);
      scopes.push(...page.pairs.filter((scope) => requestedSubjectIds.has(scope.subjectId)));
      cursor = page.nextCursor ?? undefined;
      if (cursor && visitedCursors.has(cursor)) throw new Error("Repeated learning scope cursor");
      if (cursor) visitedCursors.add(cursor);
    } while (cursor);

    return scopes;
  }

  private async reconcileLearningScopes(
    client: CompetenciesClient,
    scopes: CompetenciesLearningScope[],
  ): Promise<void> {
    for (
      let offset = 0;
      offset < scopes.length;
      offset += COMPETENCIES_FACT_RECONCILE_CONCURRENCY
    ) {
      const scopeBatch = scopes.slice(offset, offset + COMPETENCIES_FACT_RECONCILE_CONCURRENCY);
      await Promise.all(
        scopeBatch.map(async ({ subjectId, courseId }) => {
          const snapshot = await this.learningFactsRepository.snapshot(subjectId, courseId);
          return client.reconcileFacts(snapshot);
        }),
      );
    }
  }
}
