import { NotFoundException } from "@nestjs/common";
import { AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS } from "@repo/shared";

import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";
import { getUserRoomKey } from "src/file/utils/userRoom";
import { QUEUE_NAMES } from "src/queue";

import { AiJudgeConfigurationGenerationQueueService } from "./ai-judge-configuration-generation-queue.service";
import { AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME } from "./ai-judge-configuration-generation.constants";

import type { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";
import type {
  AiJudgeConfigurationGenerationJobData,
  PreparedAiJudgeConfigurationGeneration,
} from "./ai-judge-configuration-generation.types";
import type { Job, Queue } from "bullmq";
import type { QueueService } from "src/queue";
import type { RealtimePublisher } from "src/websocket/realtime.publisher";

const generationId = "00000000-0000-4000-8000-000000000001";
const tenantId = "00000000-0000-4000-8000-000000000002";
const userId = "00000000-0000-4000-8000-000000000003";
const currentUser = {
  tenantId,
  userId,
  email: "author@example.com",
  permissions: [],
  roleSlugs: [],
};
const prepared = {
  workflowInput: {
    mode: "create",
    language: "en",
    lessonContext: { aiMentorType: "roleplay" },
    brief: "Assess discovery skills.",
  },
  identities: { criteria: [], blockingErrors: [] },
} as PreparedAiJudgeConfigurationGeneration;
const input = {
  courseId: "00000000-0000-4000-8000-000000000004",
  mode: "create",
  lessonContext: { aiMentorType: "roleplay" },
  brief: "Assess discovery skills.",
} as const;

describe("AiJudgeConfigurationGenerationQueueService", () => {
  let aiJudgeConfigurationGenerationQueueService: AiJudgeConfigurationGenerationQueueService;
  let globalQueueService: jest.Mocked<QueueService>;
  let aiJudgeConfigurationGenerationService: jest.Mocked<AiJudgeConfigurationGenerationService>;
  let realtimePublisher: jest.Mocked<RealtimePublisher>;
  let queue: jest.Mocked<Queue>;
  let job: jest.Mocked<Job<AiJudgeConfigurationGenerationJobData>>;

  beforeEach(() => {
    job = {
      id: generationId,
      name: AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
      data: { tenantId, userId, prepared, cancelRequested: false },
      progress: { status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt: 1 },
      updateData: jest.fn(),
      updateProgress: jest.fn(),
    } as unknown as jest.Mocked<Job<AiJudgeConfigurationGenerationJobData>>;
    queue = {
      getJob: jest.fn().mockResolvedValue(job),
    } as unknown as jest.Mocked<Queue>;
    globalQueueService = {
      enqueue: jest.fn().mockResolvedValue(job),
      getQueue: jest.fn().mockReturnValue(queue),
    } as unknown as jest.Mocked<QueueService>;
    aiJudgeConfigurationGenerationService = {
      prepare: jest.fn().mockResolvedValue(prepared),
      execute: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationGenerationService>;
    realtimePublisher = {
      emitToRoom: jest.fn(),
    } as unknown as jest.Mocked<RealtimePublisher>;
    aiJudgeConfigurationGenerationQueueService = new AiJudgeConfigurationGenerationQueueService(
      globalQueueService,
      aiJudgeConfigurationGenerationService,
      realtimePublisher,
    );
  });

  it("authorizes and prepares the input before enqueueing an ephemeral job", async () => {
    const result = await aiJudgeConfigurationGenerationQueueService.start(input, currentUser);

    expect(aiJudgeConfigurationGenerationService.prepare).toHaveBeenCalledWith(input, currentUser);
    expect(globalQueueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.AI_JUDGE_CONFIGURATION_GENERATION,
      AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
      expect.objectContaining({ tenantId, userId, prepared, cancelRequested: false }),
      expect.objectContaining({ attempts: 1, jobId: expect.any(String) }),
    );
    expect(result.generationId).toEqual(expect.any(String));
  });

  it("does not reveal another user's generation", async () => {
    await expect(
      aiJudgeConfigurationGenerationQueueService.getSnapshot(generationId, {
        ...currentUser,
        userId: `${userId}-other`,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns drafting while the worker has not published its first snapshot", async () => {
    job.progress = 0;

    await expect(
      aiJudgeConfigurationGenerationQueueService.getSnapshot(generationId, currentUser),
    ).resolves.toEqual({
      generationId,
      progress: { status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt: 1 },
    });
  });

  it("records a cooperative cancellation request without deleting the draft", async () => {
    await expect(
      aiJudgeConfigurationGenerationQueueService.cancel(generationId, currentUser),
    ).resolves.toEqual({
      generationId,
      cancellationRequested: true,
    });
    expect(job.updateData).toHaveBeenCalledWith({ ...job.data, cancelRequested: true });
  });

  it("stores and publishes application progress to the authenticated user room", async () => {
    await aiJudgeConfigurationGenerationQueueService.publishProgress(job, {
      status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
      attempt: 1,
    });

    expect(job.updateProgress).toHaveBeenCalledWith({
      status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
      attempt: 1,
    });
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(userId),
      {
        generationId,
        progress: { status: AI_JUDGE_GENERATION_STATUS.DRAFTING, attempt: 1 },
      },
    );
  });

  it("reads cancellation from the latest BullMQ job data", async () => {
    queue.getJob.mockResolvedValue({
      ...job,
      data: { ...job.data, cancelRequested: true },
    } as unknown as Job<AiJudgeConfigurationGenerationJobData>);
    await expect(
      aiJudgeConfigurationGenerationQueueService.isCancellationRequested(job.id),
    ).resolves.toBe(true);
  });
});
