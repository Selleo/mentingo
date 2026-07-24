import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { v5 as uuidv5 } from "uuid";

import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import {
  aiJudgeGenerationApplicationProgressEventSchema,
  referencedAiJudgeConfigurationSchema,
  type AiJudgeGenerationApplicationProgressEvent,
  type AiJudgeGenerationSnapshot,
  type CancelAiJudgeGenerationResponse,
  type GenerateAiJudgeConfigurationInput,
  type StartAiJudgeGenerationResponse,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import { getUserRoomKey } from "src/file/utils/userRoom";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import {
  AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
  AI_JUDGE_CONFIGURATION_GENERATION_JOB_RETENTION,
} from "./ai-judge-configuration-generation.constants";
import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type {
  AiJudgeConfigurationGenerationJobData,
  AiJudgeGenerationStoredProgress,
} from "./ai-judge-configuration-generation.types";
import type { Job } from "bullmq";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class AiJudgeConfigurationGenerationQueueService {
  constructor(
    private readonly globalQueueService: QueueService,
    private readonly aiJudgeConfigurationGenerationService: AiJudgeConfigurationGenerationService,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async start(
    input: GenerateAiJudgeConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<StartAiJudgeGenerationResponse> {
    const prepared = await this.aiJudgeConfigurationGenerationService.prepare(input, currentUser);

    return this.enqueue(prepared, currentUser);
  }

  async revise(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<StartAiJudgeGenerationResponse> {
    const job = await this.getOwnedJob(generationId, currentUser);
    const progress = this.getProgress(job);
    if (progress.status !== AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION)
      throw new BadRequestException("common.error.aiJudgeGenerationNotAwaitingRevision");

    const prepared = this.aiJudgeConfigurationGenerationService.prepareRevision(
      job.data.prepared,
      this.getReferencedDraft(job),
      progress.validation,
      progress.attemptHistory,
    );
    const revisionGenerationId = uuidv5(`revision-${prepared.attempt}`, generationId) as UUIDType;

    return this.enqueue(prepared, currentUser, revisionGenerationId);
  }

  private async enqueue(
    prepared: AiJudgeConfigurationGenerationJobData["prepared"],
    currentUser: CurrentUserType,
    generationId: UUIDType = randomUUID() as UUIDType,
  ): Promise<StartAiJudgeGenerationResponse> {
    const data: AiJudgeConfigurationGenerationJobData = {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
      prepared,
      cancelRequested: false,
    };
    await this.globalQueueService.enqueue(
      QUEUE_NAMES.AI_JUDGE_CONFIGURATION_GENERATION,
      AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
      data,
      {
        jobId: generationId,
        attempts: 1,
        removeOnComplete: AI_JUDGE_CONFIGURATION_GENERATION_JOB_RETENTION,
        removeOnFail: AI_JUDGE_CONFIGURATION_GENERATION_JOB_RETENTION,
      },
    );

    return { generationId };
  }

  async getSnapshot(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiJudgeGenerationSnapshot> {
    const job = await this.getOwnedJob(generationId, currentUser);

    return {
      generationId,
      progress: this.getProgress(job),
    };
  }

  async cancel(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<CancelAiJudgeGenerationResponse> {
    const job = await this.getOwnedJob(generationId, currentUser);
    await job.updateData({ ...job.data, cancelRequested: true });

    return { generationId, cancellationRequested: true };
  }

  async publishProgress(
    job: Job<AiJudgeConfigurationGenerationJobData>,
    progress: AiJudgeGenerationApplicationProgressEvent,
  ) {
    if (!job.id) throw new Error("AI Judge configuration generation job has no ID");

    const referencedDraft = this.getStoredProgress(job.progress)?.referencedDraft;
    const storedProgress: AiJudgeGenerationStoredProgress = {
      progress,
      ...(referencedDraft ? { referencedDraft } : {}),
    };
    await job.updateProgress(storedProgress);
    this.realtimePublisher.emitToRoom(
      AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(job.data.userId),
      { generationId: job.id, progress } satisfies AiJudgeGenerationSnapshot,
    );
  }

  async storeReferencedDraft(
    job: Job<AiJudgeConfigurationGenerationJobData>,
    referencedDraft: NonNullable<AiJudgeGenerationStoredProgress["referencedDraft"]>,
  ) {
    const storedProgress: AiJudgeGenerationStoredProgress = {
      progress: this.getProgress(job),
      referencedDraft,
    };
    await job.updateProgress(storedProgress);
  }

  async isCancellationRequested(jobId?: string) {
    if (!jobId) return true;
    const job = await this.getQueue().getJob(jobId);

    return !job || job.data.cancelRequested;
  }

  private getReferencedDraft(
    job: Job<AiJudgeConfigurationGenerationJobData>,
  ): NonNullable<AiJudgeGenerationStoredProgress["referencedDraft"]> {
    const referencedDraft = this.getStoredProgress(job.progress)?.referencedDraft;
    if (!referencedDraft) throw new BadRequestException("common.toast.somethingWentWrong");

    return referencedDraft;
  }

  private async getOwnedJob(generationId: UUIDType, currentUser: CurrentUserType) {
    const job = await this.getQueue().getJob(generationId);
    if (
      !job ||
      job.data.tenantId !== currentUser.tenantId ||
      job.data.userId !== currentUser.userId
    )
      throw new NotFoundException("common.toast.notFound");

    return job;
  }

  private getQueue() {
    return this.globalQueueService.getQueue(QUEUE_NAMES.AI_JUDGE_CONFIGURATION_GENERATION);
  }

  getProgress(
    job: Job<AiJudgeConfigurationGenerationJobData>,
  ): AiJudgeGenerationApplicationProgressEvent {
    if (Value.Check(aiJudgeGenerationApplicationProgressEventSchema, job.progress))
      return job.progress;

    const storedProgress = this.getStoredProgress(job.progress);
    if (
      storedProgress &&
      Value.Check(aiJudgeGenerationApplicationProgressEventSchema, storedProgress.progress)
    )
      return storedProgress.progress;

    return {
      status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
      attempt: job.data.prepared.attempt,
      attemptHistory: job.data.prepared.attemptHistory,
    };
  }

  private getStoredProgress(value: Job["progress"]): AiJudgeGenerationStoredProgress | undefined {
    if (!value || typeof value !== "object" || !("progress" in value)) return undefined;
    if (!Value.Check(aiJudgeGenerationApplicationProgressEventSchema, value.progress))
      return undefined;

    const referencedDraft = "referencedDraft" in value ? value.referencedDraft : undefined;
    if (
      referencedDraft !== undefined &&
      Value.Check(referencedAiJudgeConfigurationSchema, referencedDraft)
    )
      return { progress: value.progress, referencedDraft };

    return { progress: value.progress };
  }
}
