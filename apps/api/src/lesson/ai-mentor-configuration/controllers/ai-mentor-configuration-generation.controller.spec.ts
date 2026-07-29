import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_CONFIGURATION_GENERATION_STATUS,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  PERMISSIONS,
} from "@repo/shared";

import { REQUIRED_PERMISSIONS_KEY } from "src/common/decorators/require-permission.decorator";

import { AiMentorConfigurationGenerationController } from "./ai-mentor-configuration-generation.controller";

import type { AiMentorConfigurationGenerationQueueService } from "../generation/ai-mentor-configuration-generation-queue.service";
import type { AiMentorConfigurationGenerationService } from "../generation/ai-mentor-configuration-generation.service";
import type { CurrentUserType } from "src/common/types/current-user.type";

const courseId = "4eeb7cf8-c437-4a73-867d-d58e67827eb1";
const generationId = "d223ef10-f19e-4af4-9dfc-55b60edc6fc1";
const currentUser: CurrentUserType = {
  userId: "91f378d3-8021-4269-881d-4d896ee61d66",
  tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
  email: "creator@example.com",
  roleSlugs: [],
  permissions: [],
};

describe("AiMentorConfigurationGenerationController", () => {
  const createController = () => {
    const queueService = {
      start: jest.fn().mockResolvedValue({ generationId }),
      getSnapshot: jest.fn().mockResolvedValue({
        generationId,
        progress: {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          attemptHistory: [],
        },
      }),
      revise: jest.fn().mockResolvedValue({ generationId }),
      cancel: jest.fn().mockResolvedValue({
        generationId,
        cancellationRequested: true,
      }),
    };
    const generationService = {
      validate: jest.fn().mockResolvedValue({
        passed: true,
        summary: "The configuration is ready.",
        issues: [],
      }),
    };
    const controller = new AiMentorConfigurationGenerationController(
      generationService as unknown as AiMentorConfigurationGenerationService,
      queueService as unknown as AiMentorConfigurationGenerationQueueService,
    );

    return { controller, generationService, queueService };
  };

  it("requires either course update permission at the HTTP boundary", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        AiMentorConfigurationGenerationController,
      ),
    ).toEqual([PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN]);
  });

  it("starts create with the creator-selected Teacher type and authenticated actor", async () => {
    const { controller, queueService } = createController();
    const input = {
      courseId,
      lessonContext: { title: "Discovery" },
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
      configurationType: AI_MENTOR_TYPE.TEACHER,
      brief: "Create a discovery coach.",
    } as const;

    await expect(
      controller.generateAiMentorConfiguration(input, currentUser),
    ).resolves.toEqual({ data: { generationId } });
    expect(queueService.start).toHaveBeenCalledWith(input, currentUser);
  });

  it("starts improve with the exact current unsaved Roleplay draft", async () => {
    const { controller, queueService } = createController();
    const currentConfiguration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A buyer challenges the price.",
      aiRole: "Buyer",
      learnerRole: "Sales representative",
      characterGoal: "Understand the proposal value.",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
    };
    const input = {
      courseId,
      lessonContext: { title: "Negotiation" },
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
      instruction: "Make the objections more realistic.",
      currentConfiguration,
    } as const;

    await controller.generateAiMentorConfiguration(input, currentUser);

    expect(queueService.start).toHaveBeenCalledWith(input, currentUser);
    expect(queueService.start.mock.calls[0][0].currentConfiguration).toBe(
      currentConfiguration,
    );
  });

  it("passes the current unsaved draft to non-mutating validation", async () => {
    const { controller, generationService } = createController();
    const configuration = {
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "Teach discovery.",
      expertise: "Sales coaching",
      contentScope: "Discovery questions.",
      teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
    };
    const input = {
      courseId,
      lessonContext: { title: "Discovery" },
      configuration,
    };
    const before = structuredClone(input);
    Object.freeze(configuration);

    await expect(
      controller.validateAiMentorConfigurationDraft(input, currentUser),
    ).resolves.toEqual({
      data: {
        passed: true,
        summary: "The configuration is ready.",
        issues: [],
      },
    });
    expect(generationService.validate).toHaveBeenCalledWith(input, currentUser);
    expect(generationService.validate.mock.calls[0][0].configuration).toBe(configuration);
    expect(input).toEqual(before);
  });

  it("uses the authenticated actor for snapshot, revise, and cancel operations", async () => {
    const { controller, queueService } = createController();

    await expect(
      controller.getAiMentorConfigurationGeneration(generationId, currentUser),
    ).resolves.toEqual({
      data: {
        generationId,
        progress: {
          status: AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING,
          attempt: 1,
          attemptHistory: [],
        },
      },
    });
    await expect(
      controller.reviseAiMentorConfigurationGeneration(generationId, currentUser),
    ).resolves.toEqual({ data: { generationId } });
    await expect(
      controller.cancelAiMentorConfigurationGeneration(generationId, currentUser),
    ).resolves.toEqual({
      data: { generationId, cancellationRequested: true },
    });

    expect(queueService.getSnapshot).toHaveBeenCalledWith(generationId, currentUser);
    expect(queueService.revise).toHaveBeenCalledWith(generationId, currentUser);
    expect(queueService.cancel).toHaveBeenCalledWith(generationId, currentUser);
  });
});
