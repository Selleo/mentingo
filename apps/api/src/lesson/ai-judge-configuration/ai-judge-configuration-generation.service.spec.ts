import { AI_MENTOR_ROLEPLAY_DIFFICULTY, AI_MENTOR_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";

import { AI_JUDGE_GENERATION_STATUS } from "src/ai/judge-configuration-generation/ai-judge-configuration-generation.types";

import { AiJudgeConfigurationGenerationService } from "./ai-judge-configuration-generation.service";

import type { AiJudgeConfigurationService } from "./ai-judge-configuration.service";
import type {
  AiJudgeConfigurationValidationResult,
  ReferencedAiJudgeConfiguration,
} from "src/ai/judge-configuration-generation/schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationGenerationWorkflowService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.service";
import type { AiJudgeConfigurationGenerationWorkflowOptions } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-generation-workflow.types";
import type { AiJudgeConfigurationValidatorService } from "src/ai/judge-configuration-generation/services/ai-judge-configuration-validator.service";
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
  aiMentorConfiguration: {
    type: AI_MENTOR_TYPE.ROLEPLAY,
    scenario: "A buyer challenges the price of the proposed solution.",
    aiRole: "Skeptical buyer",
    learnerRole: "Sales representative",
    characterGoal: "Understand whether the proposal justifies its price.",
    difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
  },
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
  let aiJudgeConfigurationGenerationService: AiJudgeConfigurationGenerationService;
  let aiJudgeConfigurationService: jest.Mocked<AiJudgeConfigurationService>;
  let aiJudgeConfigurationGenerationWorkflowService: jest.Mocked<AiJudgeConfigurationGenerationWorkflowService>;
  let aiJudgeConfigurationValidatorService: jest.Mocked<AiJudgeConfigurationValidatorService>;

  beforeEach(() => {
    aiJudgeConfigurationService = {
      prepareGenerationAuthoringContext: jest.fn().mockResolvedValue({
        courseId,
        baseLanguage: SUPPORTED_LANGUAGES.PL,
      }),
    } as unknown as jest.Mocked<AiJudgeConfigurationService>;
    aiJudgeConfigurationGenerationWorkflowService = {
      run: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationGenerationWorkflowService>;
    aiJudgeConfigurationValidatorService = {
      validate: jest.fn(),
    } as unknown as jest.Mocked<AiJudgeConfigurationValidatorService>;
    aiJudgeConfigurationGenerationService = new AiJudgeConfigurationGenerationService(
      aiJudgeConfigurationService,
      aiJudgeConfigurationGenerationWorkflowService,
      aiJudgeConfigurationValidatorService,
    );
  });

  it("generates an unsaved create draft in the server-derived base language", async () => {
    aiJudgeConfigurationGenerationWorkflowService.run.mockImplementation(async (input, options) => {
      await options?.onDraft?.(referencedDraft);

      return {
        status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
        attempt: 1,
        attemptHistory: [],
        configuration: currentConfiguration,
        validation: passedValidation,
      };
    });

    const result = await aiJudgeConfigurationGenerationService.generate(
      {
        courseId,
        mode: "create",
        lessonContext,
        brief: "Assess price-objection handling.",
      },
      currentUser,
    );

    expect(aiJudgeConfigurationService.prepareGenerationAuthoringContext).toHaveBeenCalledWith(
      courseId,
      undefined,
      currentUser,
    );
    expect(aiJudgeConfigurationGenerationWorkflowService.run).toHaveBeenCalledWith(
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
    aiJudgeConfigurationGenerationWorkflowService.run.mockImplementation(
      async (_input, options: AiJudgeConfigurationGenerationWorkflowOptions = {}) => {
        await options.onDraft?.(referencedDraft);

        return {
          status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
          attempt: 1,
          attemptHistory: [],
          configuration: currentConfiguration,
          validation: passedValidation,
        };
      },
    );

    const result = await aiJudgeConfigurationGenerationService.generate(
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

    expect(aiJudgeConfigurationGenerationWorkflowService.run).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "improve",
        language: SUPPORTED_LANGUAGES.PL,
        creatorInstruction: "Make the criterion observable.",
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

  it("reconciles temporary references before reporting progress", async () => {
    const reportProgress = jest.fn();
    const onReferencedDraft = jest.fn();
    aiJudgeConfigurationGenerationWorkflowService.run.mockImplementation(
      async (_input, options) => {
        await options?.onDraft?.(referencedDraft);
        await options?.reportProgress?.({
          status: AI_JUDGE_GENERATION_STATUS.EVALUATING,
          attempt: 1,
          attemptHistory: [],
          draft: referencedDraft,
        });

        return {
          status: AI_JUDGE_GENERATION_STATUS.COMPLETED,
          attempt: 1,
          attemptHistory: [],
          configuration: currentConfiguration,
          validation: passedValidation,
        };
      },
    );

    await aiJudgeConfigurationGenerationService.generate(
      {
        courseId,
        lessonId,
        mode: "improve",
        lessonContext,
        instruction: "Make the criterion observable.",
        currentConfiguration,
      },
      currentUser,
      { onReferencedDraft, reportProgress },
    );

    expect(onReferencedDraft).toHaveBeenCalledWith(referencedDraft);
    expect(reportProgress).toHaveBeenCalledWith({
      status: AI_JUDGE_GENERATION_STATUS.EVALUATING,
      attempt: 1,
      attemptHistory: [],
      draft: expect.objectContaining({
        criteria: [expect.objectContaining({ id: criterionId })],
        blockingErrors: [expect.objectContaining({ id: blockingErrorId })],
      }),
    });
  });

  it("preserves referenced criterion identities when preparing a reordered repair", () => {
    const prepared = aiJudgeConfigurationGenerationService.prepareRevision(
      {
        workflowInput: {
          mode: "improve",
          language: SUPPORTED_LANGUAGES.PL,
          lessonContext,
          instruction: "Improve the assessment.",
          currentConfiguration: referencedDraft,
        },
        identities: {
          criteria: [
            {
              ref: "C1",
              id: criterionId,
              scoreGuidance: [
                { score: 0, id: guidanceZeroId },
                { score: 1, id: guidanceOneId },
              ],
            },
          ],
          blockingErrors: [{ ref: "B1", id: blockingErrorId }],
        },
        attempt: 1,
        attemptHistory: [],
      },
      {
        ...referencedDraft,
        criteria: [
          {
            ref: "C2",
            title: "Recommendation",
            expectedBehavior: "Offers a suitable next step.",
            maxScore: 1,
            scoreGuidance: [
              { score: 0, description: "Does not offer a next step." },
              { score: 1, description: "Offers a suitable next step." },
            ],
          },
          referencedDraft.criteria[0]!,
        ],
      },
      {
        passed: false,
        summary: "Recommendation needs clarification.",
        issues: [
          {
            code: "criterion_needs_clarification",
            severity: "error",
            target: { type: "criterion", ref: "C2" },
            message: "C2 is too broad.",
            correction: "Clarify the behavior assessed by C2.",
          },
        ],
      },
      [{ attempt: 1, changes: [], validation: passedValidation }],
    );

    expect(prepared.workflowInput).toMatchObject({
      mode: "repair",
      currentConfiguration: {
        criteria: [
          expect.objectContaining({ ref: "C2", title: "Recommendation" }),
          expect.objectContaining({ ref: "C1", title: "Clarifies the objection" }),
        ],
      },
      blockingIssues: [expect.objectContaining({ target: { type: "criterion", ref: "C2" } })],
    });
    expect(prepared.identities.criteria[0]?.ref).toBe("C1");
  });

  it("returns deterministic findings without calling the semantic Validator", async () => {
    const result = await aiJudgeConfigurationGenerationService.validate(
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
    expect(aiJudgeConfigurationValidatorService.validate).not.toHaveBeenCalled();
  });

  it("validates the submitted form values without loading or persisting a configuration", async () => {
    aiJudgeConfigurationValidatorService.validate.mockResolvedValue(passedValidation);

    const result = await aiJudgeConfigurationGenerationService.validate(
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
    expect(aiJudgeConfigurationService.prepareGenerationAuthoringContext).toHaveBeenCalledWith(
      courseId,
      lessonId,
      currentUser,
    );
    expect(aiJudgeConfigurationValidatorService.validate).toHaveBeenCalledWith(
      expect.objectContaining({
        language: SUPPORTED_LANGUAGES.PL,
        brief: "Assess price-objection handling.",
        configuration: expect.objectContaining({
          criteria: [expect.objectContaining({ ref: "C1" })],
        }),
      }),
    );
    expect(aiJudgeConfigurationGenerationWorkflowService.run).not.toHaveBeenCalled();
  });
});
