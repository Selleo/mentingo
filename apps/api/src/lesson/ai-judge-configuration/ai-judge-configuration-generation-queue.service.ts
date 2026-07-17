import { randomUUID } from "node:crypto";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import {
  aiJudgeGenerationApplicationProgressEventSchema,
  type AiJudgeGenerationApplicationProgressEvent,
  type AiJudgeGenerationSnapshot,
  type CancelAiJudgeGenerationResponse,
  type GenerateAiJudgeConfigurationInput,
  type StartAiJudgeGenerationResponse,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { getUserRoomKey } from "src/file/utils/userRoom";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import {
  AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
  AI_JUDGE_CONFIGURATION_GENERATION_JOB_RETENTION,
} from "./ai-judge-configuration-generation.constants";
import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type { AiJudgeConfigurationGenerationJobData } from "./ai-judge-configuration-generation.types";
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
    const generationId = randomUUID() as UUIDType;
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

    await job.updateProgress(progress);
    this.realtimePublisher.emitToRoom(
      AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(job.data.userId),
      { generationId: job.id, progress } satisfies AiJudgeGenerationSnapshot,
    );
  }

  async isCancellationRequested(jobId?: string) {
    if (!jobId) return true;
    const job = await this.getQueue().getJob(jobId);

    return !job || job.data.cancelRequested;
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
      return job.progress as AiJudgeGenerationApplicationProgressEvent;

    return { status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt: 1 };
  }
}
