import { AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";

import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type { AiJudgeConfigurationService } from "./ai-judge-configuration.service";
import type { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation-workflow.service";
import type { AiJudgeConfigurationGenerationWorkflowOptions } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation-workflow.types";
import type {
  AiJudgeConfigurationValidationResult,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/ai-judge-configuration-validator.service";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const courseId = "00000000-0000-4000-8000-000000000001" as UUIDType;
const lessonId = "00000000-0000-4000-8000-000000000002" as UUIDType;
const criterionId = "00000000-0000-4000-8000-000000000003" as UUIDType;
const guidanceZeroId = "00000000-0000-4000-8000-000000000004" as UUIDType;
const guidanceOneId = "00000000-0000-4000-8000-000000000005" as UUIDType;
const blockingErrorId = "00000000-0000-4000-8000-000000000006" as UUIDType;
const currentUser = {} as CurrentUserType;
const lessonContext = {
  title: "Handle a price objection",
  aiMentorType: AI_MENTOR_TYPE.ROLEPLAY,
};
const passedValidation: AiJudgeConfigurationValidationResult = {
  passed: true,
  summary: "The assessment is coherent.",
  issues: [],
};
const referencedDraft: ReferencedAiJudgeConfiguration = {
  taskGoal: "The learner clarifies the objection and agrees a next step.",
  passingThresholdPercent: 70,
  criteria: [
    {
      ref: "C1",
      title: "Clarifies the objection",
      expectedBehavior: "Asks a focused question before proposing a solution.",
      maxScore: 1,
      scoreGuidance: [
        { score: 0, description: "Does not investigate the objection." },
        { score: 1, description: "Clarifies the reason for the objection." },
      ],
    },
  ],
  blockingErrors: [{ ref: "B1", description: "Invents contractual guarantees." }],
};
const currentConfiguration = {
  taskGoal: "The learner handles a price objection.",
  passingThresholdPercent: 70,
  criteria: [
    {
      id: criterionId,
      title: "Handles the objection",
      expectedBehavior: "Responds to the buyer's concern.",
      maxScore: 1,
      scoreGuidance: [
        { id: guidanceZeroId, score: 0, description: "Does not address the concern." },
        { id: guidanceOneId, score: 1, description: "Addresses the concern." },
      ],
    },
  ],
  blockingErrors: [{ id: blockingErrorId, description: "Invents contractual guarantees." }],
};

describe("AiJudgeConfigurationGenerationService", () => {
  let service: AiJudgeConfigurationGenerationService;
  let configurationService: jest.Mocked<AiJudgeConfigurationService>;
  let workflowService: jest.Mocked<AiJudgeConfigurationGenerationWorkflowService>;
  let validatorService: jest.Mocked<AiJudgeConfigurationValidatorService>;

  beforeEach(() => {
    configurationService = {
      prepareGenerationAuthoringContext: jest.fn().mockResolvedValue({
        courseId,
        baseLanguage: SUPPORTED_LANGUAGES.PL,
      }),
    } as unknown as jest.Mocked<AiJudgeConfigurationService>;
    workflowService = {
      run: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationGenerationWorkflowService>;
    validatorService = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationValidatorService>;
    service = new AiJudgeConfigurationGenerationService(
      configurationService,
      workflowService,
      validatorService,
    );
  });

  it("generates an unsaved create draft in the server-derived base language", async () => {
    workflowService.run.mockImplementation(async (input, options) => {
      await options?.onDraft?.(referencedDraft);

      return {
        status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
        attempt: 1,
        configuration: currentConfiguration,
        validation: passedValidation,
      };
    });

    const result = await service.generate(
      {
        courseId,
        mode: "create",
        lessonContext,
        brief: "Assess price-objection handling.",
      },
      currentUser,
    );

    expect(configurationService.prepareGenerationAuthoringContext).toHaveBeenCalledWith(
      courseId,
      undefined,
      currentUser,
    );
    expect(workflowService.run).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "create", language: SUPPORTED_LANGUAGES.PL }),
      expect.objectContaining({ onDraft: expect.any(Function) }),
    );
    expect(result.configuration).toEqual({
      taskGoal: referencedDraft.taskGoal,
      passingThresholdPercent: referencedDraft.passingThresholdPercent,
      criteria: [expect.not.objectContaining({ id: expect.anything() })],
      blockingErrors: [expect.not.objectContaining({ id: expect.anything() })],
    });
  });

  it("preserves persisted identities when improving unsaved form values", async () => {
    workflowService.run.mockImplementation(
      async (_input, options: AiJudgeConfigurationGenerationWorkflowOptions = {}) => {
        await options.onDraft?.(referencedDraft);

        return {
          status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
          attempt: 1,
          configuration: currentConfiguration,
          validation: passedValidation,
        };
      },
    );

    const result = await service.generate(
      {
        courseId,
        lessonId,
        mode: "improve",
        lessonContext,
        instruction: "Make the criterion observable.",
        currentConfiguration,
      },
      currentUser,
    );

    expect(workflowService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "improve",
        language: SUPPORTED_LANGUAGES.PL,
        currentConfiguration: expect.objectContaining({
          criteria: [expect.objectContaining({ ref: "C1" })],
          blockingErrors: [expect.objectContaining({ ref: "B1" })],
        }),
      }),
      expect.any(Object),
    );
    expect(result.configuration).toMatchObject({
      criteria: [
        {
          id: criterionId,
          scoreGuidance: [{ id: guidanceZeroId }, { id: guidanceOneId }],
        },
      ],
      blockingErrors: [{ id: blockingErrorId }],
    });
  });

  it("returns deterministic findings without calling the semantic Validator", async () => {
    const result = await service.validate(
      {
        courseId,
        lessonContext,
        configuration: {
          ...currentConfiguration,
          criteria: [
            {
              ...currentConfiguration.criteria[0],
              scoreGuidance: [{ score: 0, description: "No evidence." }],
            },
          ],
        },
      },
      currentUser,
    );

    expect(result).toMatchObject({
      passed: false,
      issues: [expect.objectContaining({ code: "missing_guidance_scores" })],
    });
    expect(validatorService.validate).not.toHaveBeenCalled();
  });

  it("validates the submitted form values without loading or persisting a configuration", async () => {
    validatorService.validate.mockResolvedValue(passedValidation);

    const result = await service.validate(
      {
        courseId,
        lessonId,
        lessonContext,
        brief: "Assess price-objection handling.",
        configuration: currentConfiguration,
      },
      currentUser,
    );

    expect(result).toEqual(passedValidation);
    expect(configurationService.prepareGenerationAuthoringContext).toHaveBeenCalledWith(
      courseId,
      lessonId,
      currentUser,
    );
    expect(validatorService.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: SUPPORTED_LANGUAGES.PL,
        brief: "Assess price-objection handling.",
        configuration: expect.objectContaining({
          criteria: [expect.objectContaining({ ref: "C1" })],
        }),
      }),
    );
    expect(workflowService.run).not.toHaveBeenCalled();
  });
});
