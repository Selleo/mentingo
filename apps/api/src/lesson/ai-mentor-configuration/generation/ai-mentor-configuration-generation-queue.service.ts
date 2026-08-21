import { randomUUID } from "node:crypto";

import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import { v5 as uuidv5 } from "uuid";

import {
  aiMentorConfigurationGenerationProgressEventSchema,
  type AiMentorConfigurationGenerationProgressEvent,
  type AiMentorConfigurationGenerationSnapshot,
  type CancelAiMentorConfigurationGenerationResponse,
  type GenerateAiMentorConfigurationInput,
  type StartAiMentorConfigurationGenerationResponse,
} from "src/ai/mentor-configuration-generation/schemas/ai-mentor-configuration-generation.schema";
import { getUserRoomKey } from "src/file/utils/userRoom";
import { QUEUE_NAMES, QueueService } from "src/queue";
import { REALTIME_PUBLISHER, type RealtimePublisher } from "src/websocket/realtime.publisher";

import { aiMentorConfigurationContentSchema } from "../schemas/ai-mentor-configuration.schema";

import {
  AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME,
  AI_MENTOR_CONFIGURATION_GENERATION_JOB_RETENTION,
} from "./ai-mentor-configuration-generation.constants";
import { AiMentorConfigurationGenerationService } from "./ai-mentor-configuration-generation.service";

import type {
  AiMentorConfigurationGenerationJobData,
  AiMentorConfigurationGenerationStoredProgress,
} from "./ai-mentor-configuration-generation.types";
import type { Job } from "bullmq";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

@Injectable()
export class AiMentorConfigurationGenerationQueueService {
  constructor(
    private readonly globalQueueService: QueueService,
    private readonly generationService: AiMentorConfigurationGenerationService,
    @Inject(REALTIME_PUBLISHER) private readonly realtimePublisher: RealtimePublisher,
  ) {}

  async start(
    input: GenerateAiMentorConfigurationInput,
    currentUser: CurrentUserType,
  ): Promise<StartAiMentorConfigurationGenerationResponse> {
    const prepared = await this.generationService.prepare(input, currentUser);
    return this.enqueue(prepared, currentUser);
  }

  async revise(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<StartAiMentorConfigurationGenerationResponse> {
    const job = await this.getOwnedJob(generationId, currentUser);
    const progress = this.getProgress(job);
    if (progress.status !== AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION)
      throw new BadRequestException(
        "common.error.aiMentorConfigurationGenerationNotAwaitingRevision",
      );

    const prepared = this.generationService.prepareRevision(
      job.data.prepared,
      this.getLatestDraft(job),
      progress.validation,
      progress.attemptHistory,
    );
    const revisionGenerationId = uuidv5(`revision-${prepared.attempt}`, generationId);

    return this.enqueue(prepared, currentUser, revisionGenerationId);
  }

  async getSnapshot(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<AiMentorConfigurationGenerationSnapshot> {
    const job = await this.getOwnedJob(generationId, currentUser);
    return { generationId, progress: this.getProgress(job) };
  }

  async cancel(
    generationId: UUIDType,
    currentUser: CurrentUserType,
  ): Promise<CancelAiMentorConfigurationGenerationResponse> {
    const job = await this.getOwnedJob(generationId, currentUser);
    await job.updateData({ ...job.data, cancelRequested: true });
    return { generationId, cancellationRequested: true };
  }

  async publishProgress(
    job: Job<AiMentorConfigurationGenerationJobData>,
    progress: AiMentorConfigurationGenerationProgressEvent,
  ) {
    if (!job.id) throw new Error("AI Mentor configuration generation job has no ID");

    const latestDraft = this.getStoredProgress(job.progress)?.latestDraft;
    await job.updateProgress({
      progress,
      ...(latestDraft ? { latestDraft } : {}),
    } satisfies AiMentorConfigurationGenerationStoredProgress);
    this.realtimePublisher.emitToRoom(
      AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(job.data.userId),
      { generationId: job.id, progress } satisfies AiMentorConfigurationGenerationSnapshot,
    );
  }

  async storeLatestDraft(
    job: Job<AiMentorConfigurationGenerationJobData>,
    latestDraft: AiMentorConfigurationContent,
  ) {
    await job.updateProgress({
      progress: this.getProgress(job),
      latestDraft,
    } satisfies AiMentorConfigurationGenerationStoredProgress);
  }

  async isCancellationRequested(jobId?: string) {
    if (!jobId) return true;
    const job = await this.getQueue().getJob(jobId);
    return !job || job.data.cancelRequested;
  }

  getProgress(
    job: Job<AiMentorConfigurationGenerationJobData>,
  ): AiMentorConfigurationGenerationProgressEvent {
    if (Value.Check(aiMentorConfigurationGenerationProgressEventSchema, job.progress))
      return job.progress;

    const stored = this.getStoredProgress(job.progress);
    if (stored) return stored.progress;

    return {
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
      attempt: job.data.prepared.attempt,
      attemptHistory: job.data.prepared.attemptHistory,
    };
  }

  private async enqueue(
    prepared: AiMentorConfigurationGenerationJobData["prepared"],
    currentUser: CurrentUserType,
    generationId: UUIDType = randomUUID(),
  ) {
    const data: AiMentorConfigurationGenerationJobData = {
      tenantId: currentUser.tenantId,
      userId: currentUser.userId,
      prepared,
      cancelRequested: false,
    };
    await this.globalQueueService.enqueue(
      QUEUE_NAMES.AI_MENTOR_CONFIGURATION_GENERATION,
      AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME,
      data,
      {
        jobId: generationId,
        attempts: 1,
        removeOnComplete: AI_MENTOR_CONFIGURATION_GENERATION_JOB_RETENTION,
        removeOnFail: AI_MENTOR_CONFIGURATION_GENERATION_JOB_RETENTION,
      },
    );

    return { generationId };
  }

  private getLatestDraft(
    job: Job<AiMentorConfigurationGenerationJobData>,
  ): AiMentorConfigurationContent {
    const latestDraft = this.getStoredProgress(job.progress)?.latestDraft;
    if (!latestDraft) throw new BadRequestException("common.toast.somethingWentWrong");
    return latestDraft;
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
    return this.globalQueueService.getQueue(QUEUE_NAMES.AI_MENTOR_CONFIGURATION_GENERATION);
  }

  private getStoredProgress(
    value: Job["progress"],
  ): AiMentorConfigurationGenerationStoredProgress | undefined {
    if (!value || typeof value !== "object" || !("progress" in value)) return undefined;
    if (!Value.Check(aiMentorConfigurationGenerationProgressEventSchema, value.progress))
      return undefined;

    const latestDraft = "latestDraft" in value ? value.latestDraft : undefined;
    if (latestDraft !== undefined && Value.Check(aiMentorConfigurationContentSchema, latestDraft))
      return { progress: value.progress, latestDraft };

    return { progress: value.progress };
  }
}
