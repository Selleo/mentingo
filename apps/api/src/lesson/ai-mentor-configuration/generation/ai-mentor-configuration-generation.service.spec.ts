import {
  AI_MENTOR_CONFIGURATION_FIELD,
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";

import { AiMentorConfigurationGenerationService } from "./ai-mentor-configuration-generation.service";

import type { AiMentorConfigurationService } from "../services/ai-mentor-configuration.service";
import type { AiMentorConfigurationGenerationWorkflowService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-generation-workflow.service";
import type { AiMentorConfigurationValidatorService } from "src/ai/mentor-configuration-generation/services/ai-mentor-configuration-validator.service";
import type { CurrentUserType } from "src/common/types/current-user.type";

const currentUser = {
  userId: "91f378d3-8021-4269-881d-4d896ee61d66",
  tenantId: "242359db-654d-4af2-93ee-71ac0ddb4d9f",
} as CurrentUserType;
const courseId = "4eeb7cf8-c437-4a73-867d-d58e67827eb1";

describe("AiMentorConfigurationGenerationService", () => {
  const createService = () => {
    const configurationService = {
      prepareGenerationAuthoringContext: jest.fn().mockResolvedValue({
        courseId,
        baseLanguage: SUPPORTED_LANGUAGES.PL,
      }),
    };
    const workflowService = { run: jest.fn() };
    const validatorService = { validate: jest.fn() };
    const service = new AiMentorConfigurationGenerationService(
      configurationService as unknown as AiMentorConfigurationService,
      workflowService as unknown as AiMentorConfigurationGenerationWorkflowService,
      validatorService as unknown as AiMentorConfigurationValidatorService,
    );

    return { configurationService, workflowService, validatorService, service };
  };

  it("prepares create in the server-derived base language and creator-selected type", async () => {
    const { service } = createService();

    const prepared = await service.prepare(
      {
        courseId,
        lessonContext: { title: "Discovery" },
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.CREATE,
        configurationType: AI_MENTOR_TYPE.TEACHER,
        brief: "Create a Teacher.",
      },
      currentUser,
    );

    expect(prepared.workflowInput).toMatchObject({
      mode: "create",
      configurationType: AI_MENTOR_TYPE.TEACHER,
      language: SUPPORTED_LANGUAGES.PL,
    });
  });

  it("uses the current unsaved type after a manual change for improve", async () => {
    const { service } = createService();
    const currentConfiguration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "",
      aiRole: "Buyer",
    };

    const prepared = await service.prepare(
      {
        courseId,
        lessonContext: { title: "Negotiation" },
        mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
        instruction: "Complete the Roleplay.",
        currentConfiguration,
      },
      currentUser,
    );

    expect(prepared.workflowInput).toMatchObject({
      mode: "improve",
      configurationType: AI_MENTOR_TYPE.ROLEPLAY,
      currentConfiguration,
    });
  });

  it("quality-checks incomplete current values deterministically without AI or persistence", async () => {
    const { service, validatorService, configurationService } = createService();

    const result = await service.validate(
      {
        courseId,
        lessonContext: { title: "Negotiation" },
        configuration: {
          type: AI_MENTOR_TYPE.ROLEPLAY,
          scenario: "",
          difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        },
      },
      currentUser,
    );

    expect(result.passed).toBe(false);
    expect(result.issues.map(({ target }) => target.field)).toContain(
      AI_MENTOR_CONFIGURATION_FIELD.SCENARIO,
    );
    expect(validatorService.validate).not.toHaveBeenCalled();
    expect(configurationService.prepareGenerationAuthoringContext).toHaveBeenCalledTimes(1);
  });

  it("quality-checks the exact complete unsaved configuration semantically", async () => {
    const { service, validatorService } = createService();
    const configuration = {
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A buyer challenges the price.",
      aiRole: "Buyer",
      learnerRole: "Sales representative",
      characterGoal: "Understand the value.",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
    };
    validatorService.validate.mockResolvedValue({
      passed: true,
      summary: "The configuration is ready.",
      issues: [],
    });

    await service.validate(
      {
        courseId,
        lessonContext: { title: "Negotiation" },
        configuration,
      },
      currentUser,
    );

    expect(validatorService.validate).toHaveBeenCalledWith(
      expect.objectContaining({ configuration }),
    );
  });
});
