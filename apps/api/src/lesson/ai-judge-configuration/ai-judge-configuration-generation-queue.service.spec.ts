import { NotFoundException } from "@nestjs/common";
import {
  AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { v5 as uuidv5 } from "uuid";

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
const lessonContext = {
  aiMentorConfiguration: {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: "A buyer challenges the price of the proposed solution.",
    aiRole: "Skeptical buyer",
    learnerRole: "Sales representative",
    characterGoal: "Understand whether the proposal justifies its price.",
    difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
  },
} as const;
const prepared = {
  workflowInput: {
    mode: "create",
    language: SUPPORTED_LANGUAGES.EN,
    lessonContext,
    brief: "Assess discovery skills.",
  },
  identities: { criteria: [], blockingErrors: [] },
  attempt: 1,
  attemptHistory: [],
} as PreparedAiJudgeConfigurationGeneration;
const input = {
  courseId: "00000000-0000-4000-8000-000000000004",
  mode: "create",
  lessonContext,
  brief: "Assess discovery skills.",
} as const;
const generatedConfiguration = {
  taskGoal: "The learner discovers the customer's needs.",
  passingThresholdPercent: 70,
  criteria: [],
  blockingErrors: [],
};
const referencedDraft = {
  ...generatedConfiguration,
  criteria: [],
  blockingErrors: [],
};
const failedValidation = {
  passed: false,
  summary: "The task goal needs more detail.",
  issues: [],
};

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
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: 1,
        attemptHistory: [],
      },
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
      prepareRevision: jest.fn().mockReturnValue({
        ...prepared,
        attempt: 2,
        attemptHistory: [{ attempt: 1, changes: [], validation: failedValidation }],
      }),
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
    job.data.prepared = {
      ...prepared,
      attempt: 2,
      attemptHistory: [{ attempt: 1, changes: [], validation: failedValidation }],
    };

    await expect(
      aiJudgeConfigurationGenerationQueueService.getSnapshot(generationId, currentUser),
    ).resolves.toEqual({
      generationId,
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: 2,
        attemptHistory: [{ attempt: 1, changes: [], validation: failedValidation }],
      },
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

  it("starts the next attempt only after the creator approves Validator feedback", async () => {
    const progress = {
      status: AI_JUDGE_GENERATION_STATUS.AWAITING_REVISION,
      attempt: 1,
      configuration: generatedConfiguration,
      validation: failedValidation,
      attemptHistory: [{ attempt: 1, changes: [], validation: failedValidation }],
    };
    job.progress = { progress, referencedDraft };

    await expect(
      aiJudgeConfigurationGenerationQueueService.revise(generationId, currentUser),
    ).resolves.toEqual({ generationId: expect.any(String) });
    expect(aiJudgeConfigurationGenerationService.prepareRevision).toHaveBeenCalledWith(
      prepared,
      referencedDraft,
      failedValidation,
      progress.attemptHistory,
    );
    const expectedRevisionGenerationId = uuidv5("revision-2", generationId);
    expect(globalQueueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.AI_JUDGE_CONFIGURATION_GENERATION,
      AI_JUDGE_CONFIGURATION_GENERATION_JOB_NAME,
      expect.objectContaining({ prepared: expect.objectContaining({ attempt: 2 }) }),
      expect.objectContaining({ attempts: 1, jobId: expectedRevisionGenerationId }),
    );
    await expect(
      aiJudgeConfigurationGenerationQueueService.revise(generationId, currentUser),
    ).resolves.toEqual({ generationId: expectedRevisionGenerationId });
  });

  it("stores and publishes application progress to the authenticated user room", async () => {
    await aiJudgeConfigurationGenerationQueueService.publishProgress(job, {
      status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
      attempt: 1,
      attemptHistory: [],
    });

    expect(job.updateProgress).toHaveBeenCalledWith({
      progress: {
        status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
        attempt: 1,
        attemptHistory: [],
      },
    });
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      AI_JUDGE_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(userId),
      {
        generationId,
        progress: {
          status: AI_JUDGE_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          attemptHistory: [],
        },
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

  it("stores the referenced draft separately from public progress", async () => {
    await aiJudgeConfigurationGenerationQueueService.storeReferencedDraft(job, referencedDraft);

    expect(job.updateProgress).toHaveBeenCalledWith({
      progress: job.progress,
      referencedDraft,
    });
  });
});
