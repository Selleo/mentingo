import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { getUserRoomKey } from "src/file/utils/userRoom";
import { QUEUE_NAMES } from "src/queue";

import { AiMentorConfigurationGenerationQueueService } from "./ai-mentor-configuration-generation-queue.service";
import { AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME } from "./ai-mentor-configuration-generation.constants";

import type { AiMentorConfigurationGenerationService } from "./ai-mentor-configuration-generation.service";
import type {
  AiMentorConfigurationGenerationJobData,
  PreparedAiMentorConfigurationGeneration,
} from "./ai-mentor-configuration-generation.types";
import type { Job, Queue } from "bullmq";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { QueueService } from "src/queue";
import type { RealtimePublisher } from "src/websocket/realtime.publisher";

const currentUser = {
  userId: "91f378d3-8021-4269-881d-4d896ee61d66",
  tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
} as CurrentUserType;
const generationId = "4eeb7cf8-c437-4a73-867d-d58e67827eb1";
const teacherDraft = {
  type: AI_MENTOR_TYPE.TEACHER,
  taskGoal: "Teach discovery.",
  expertise: "Sales coaching",
  contentScope: "Discovery questions.",
  teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
};
const validation = {
  passed: false,
  summary: "The scope needs correction.",
  issues: [],
};
const prepared: PreparedAiMentorConfigurationGeneration = {
  workflowInput: {
    mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
    configurationType: AI_MENTOR_TYPE.TEACHER,
    language: SUPPORTED_LANGUAGES.EN,
    lessonContext: { title: "Discovery" },
    brief: "Create a Teacher.",
  },
  attempt: 1,
  attemptHistory: [],
};

describe("AiMentorConfigurationGenerationQueueService", () => {
  const createService = () => {
    const job = {
      id: generationId,
      data: {
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        prepared,
        cancelRequested: false,
      },
      progress: 0,
      updateData: jest.fn(),
      updateProgress: jest.fn(async function (this: { progress: Job["progress"] }, progress) {
        this.progress = progress;
      }),
    } as unknown as Job<AiMentorConfigurationGenerationJobData>;
    const queue = { getJob: jest.fn().mockResolvedValue(job) };
    const globalQueueService = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getQueue: jest.fn().mockReturnValue(queue),
    };
    const generationService = {
      prepare: jest.fn().mockResolvedValue(prepared),
      prepareRevision: jest.fn().mockReturnValue({
        ...prepared,
        workflowInput: {
          mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.REPAIR,
          configurationType: AI_MENTOR_TYPE.TEACHER,
          language: SUPPORTED_LANGUAGES.EN,
          lessonContext: { title: "Discovery" },
          currentConfiguration: teacherDraft,
          blockingIssues: [],
        },
        attempt: 2,
        attemptHistory: [{ attempt: 1, changes: [], validation }],
      }),
    };
    const realtimePublisher = { emitToRoom: jest.fn() };
    const service = new AiMentorConfigurationGenerationQueueService(
      globalQueueService as unknown as QueueService,
      generationService as unknown as AiMentorConfigurationGenerationService,
      realtimePublisher as unknown as RealtimePublisher,
    );

    return {
      generationService,
      globalQueueService,
      job,
      queue: queue as unknown as Queue,
      realtimePublisher,
      service,
    };
  };

  it("authorizes and prepares before enqueueing an ephemeral tenant-owned job", async () => {
    const { generationService, globalQueueService, service } = createService();
    const input = {
      courseId: generationId,
      lessonContext: { title: "Discovery" },
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: AI_MENTOR_TYPE.TEACHER,
      brief: "Create a Teacher.",
    };

    await service.start(input, currentUser);

    expect(generationService.prepare).toHaveBeenCalledWith(input, currentUser);
    expect(globalQueueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.AI_MENTOR_CONFIGURATION_GENERATION,
      AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME,
      expect.objectContaining({
        tenantId: currentUser.tenantId,
        userId: currentUser.userId,
        prepared,
      }),
      expect.objectContaining({ attempts: 1 }),
    );
  });

  it("does not reveal another user's generation", async () => {
    const { service } = createService();

    await expect(
      service.getSnapshot(generationId, {
        ...currentUser,
        userId: "4afc9eb9-435d-43ea-a543-e63b264d18f4",
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("stores the draft privately while publishing progress to the user room", async () => {
    const { job, realtimePublisher, service } = createService();
    await service.storeLatestDraft(job, teacherDraft);
    const progress = {
      status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING,
      attempt: 1,
      attemptHistory: [],
      draft: teacherDraft,
    };

    await service.publishProgress(job, progress);

    expect(job.updateProgress).toHaveBeenLastCalledWith({
      progress,
      latestDraft: teacherDraft,
    });
    expect(realtimePublisher.emitToRoom).toHaveBeenCalledWith(
      AI_MENTOR_CONFIGURATION_GENERATION_SOCKET_EVENTS.PROGRESS,
      getUserRoomKey(currentUser.userId),
      { generationId, progress },
    );
  });

  it("starts a deterministic next repair only from awaiting revision", async () => {
    const { generationService, globalQueueService, job, service } = createService();
    job.progress = {
      progress: {
        status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.AWAITING_REVISION,
        attempt: 1,
        attemptHistory: [{ attempt: 1, changes: [], validation }],
        configuration: teacherDraft,
        validation,
      },
      latestDraft: teacherDraft,
    };

    await service.revise(generationId, currentUser);

    expect(generationService.prepareRevision).toHaveBeenCalledWith(
      prepared,
      teacherDraft,
      validation,
      [{ attempt: 1, changes: [], validation }],
    );
    expect(globalQueueService.enqueue).toHaveBeenCalledWith(
      QUEUE_NAMES.AI_MENTOR_CONFIGURATION_GENERATION,
      AI_MENTOR_CONFIGURATION_GENERATION_JOB_NAME,
      expect.objectContaining({ prepared: expect.objectContaining({ attempt: 2 }) }),
      expect.objectContaining({ jobId: expect.any(String) }),
    );
  });
});
