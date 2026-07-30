import { Value } from "@sinclair/typebox/value";

import {
  aiJudgeConfigurationValidatorModelResultSchema,
  aiJudgeConfigurationValidatorStructuredOutputSchema,
  aiJudgeConfigurationValidationResultSchema,
  aiJudgeGenerationApplicationResultSchema,
  aiJudgeGenerationProgressEventSchema,
  aiJudgeGenerationResultSchema,
  aiJudgeGenerationSnapshotSchema,
  generateAiJudgeConfigurationInputSchema,
  referencedAiJudgeConfigurationSchema,
  referencedAiJudgeConfigurationStructuredOutputSchema,
  validateAiJudgeConfigurationInputSchema,
} from "./ai-judge-configuration-generation.schema";

const courseId = "baeb297a-b7d0-498a-bd4d-d70afcc428f1";

const lessonContext = {
  title: "Handle a difficult sales objection",
  taskDescription: "Reach an agreed next step.",
  aiMentorInstructions: "Act as a skeptical buyer.",
  aiMentorType: "roleplay",
} as const;

const configuration = {
  taskGoal: "The learner agrees a concrete next step with the buyer.",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Clarifies the objection",
      expectedBehavior: "Asks at least one question before proposing a solution.",
      maxScore: 2,
      scoreGuidance: [
        { score: 0, description: "Does not investigate the objection." },
        { score: 1, description: "Asks a broad question without following up." },
        {
          score: 2,
          description: "Clarifies the cause and impact of the objection.",
          example: "What part of the proposal creates the greatest concern for you?",
        },
      ],
    },
  ],
  blockingErrors: [{ description: "Invents contractual guarantees." }],
};

const referencedConfiguration = {
  ...configuration,
  criteria: configuration.criteria.map((criterion) => ({ ...criterion, ref: "C1" })),
  blockingErrors: configuration.blockingErrors.map((blockingError) => ({
    ...blockingError,
    ref: "B1",
  })),
};

const validation = {
  passed: false,
  summary: "One scoring level needs a more observable distinction.",
  issues: [
    {
      code: "score_guidance_not_distinct",
      severity: "error",
      target: { type: "scoreGuidance", ref: "C1", score: 1, field: "description" },
      message: "The partial score is too similar to the full score.",
      correction: "Describe the missing follow-up behavior at score 1.",
    },
  ],
} as const;

describe("AI Judge configuration generation schemas", () => {
  it("accepts a create request without persisted or language-specific input", () => {
    expect(
      Value.Check(generateAiJudgeConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: "create",
        brief: "Assess whether the learner can handle a price objection.",
      }),
    ).toBe(true);

    expect(
      Value.Check(generateAiJudgeConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: "create",
        brief: "Assess objection handling.",
        language: "pl",
      }),
    ).toBe(false);
  });

  it("requires complete configuration context for improve requests", () => {
    expect(
      Value.Check(generateAiJudgeConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: "improve",
        instruction: "Make the partial score more concrete.",
        brief: "Assess objection handling.",
        currentConfiguration: configuration,
        latestValidation: validation,
      }),
    ).toBe(true);

    expect(
      Value.Check(generateAiJudgeConfigurationInputSchema, {
        courseId,
        lessonContext,
        mode: "improve",
        instruction: "Make the partial score more concrete.",
      }),
    ).toBe(false);
  });

  it("accepts only compact temporary references in model-facing drafts", () => {
    expect(Value.Check(referencedAiJudgeConfigurationSchema, referencedConfiguration)).toBe(true);
    expect(
      Value.Check(referencedAiJudgeConfigurationSchema, {
        ...referencedConfiguration,
        criteria: [{ ...referencedConfiguration.criteria[0], ref: "criterion-1" }],
      }),
    ).toBe(false);
    expect(
      Value.Check(referencedAiJudgeConfigurationSchema, {
        ...referencedConfiguration,
        criteria: [
          {
            ...referencedConfiguration.criteria[0],
            id: "87ee9005-970c-45f2-a9b0-5cf642440ff7",
          },
        ],
      }),
    ).toBe(false);
  });

  it("requires nullable optional values to be present in strict model output", () => {
    expect(
      Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, referencedConfiguration),
    ).toBe(false);
    expect(
      Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, {
        ...referencedConfiguration,
        criteria: referencedConfiguration.criteria.map((criterion) => ({
          ...criterion,
          scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
            ...guidance,
            example: guidance.example ?? null,
          })),
        })),
      }),
    ).toBe(true);

    const { passed: _passed, ...modelResult } = validation;
    expect(Value.Check(aiJudgeConfigurationValidatorStructuredOutputSchema, modelResult)).toBe(
      true,
    );
    expect(
      Value.Check(aiJudgeConfigurationValidatorStructuredOutputSchema, {
        ...modelResult,
        issues: modelResult.issues.map((issue) => ({
          ...issue,
          target: { ...issue.target, field: undefined },
        })),
      }),
    ).toBe(false);
  });

  it("does not force generated assessment prose to end at a character boundary", () => {
    const structuredConfiguration = {
      ...referencedConfiguration,
      criteria: referencedConfiguration.criteria.map((criterion) => ({
        ...criterion,
        scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
          ...guidance,
          example: guidance.example ?? null,
        })),
      })),
    };

    expect(
      Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, {
        ...structuredConfiguration,
        taskGoal: "x".repeat(321),
      }),
    ).toBe(true);
    expect(
      Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, {
        ...structuredConfiguration,
        criteria: structuredConfiguration.criteria.map((criterion) => ({
          ...criterion,
          scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
            ...guidance,
            description: "x".repeat(281),
          })),
        })),
      }),
    ).toBe(true);
    expect(
      Value.Check(referencedAiJudgeConfigurationStructuredOutputSchema, {
        ...structuredConfiguration,
        blockingErrors: [{ ref: "B1", description: "x".repeat(361) }],
      }),
    ).toBe(true);
  });

  it("uses target-specific Validator finding shapes", () => {
    expect(Value.Check(aiJudgeConfigurationValidationResultSchema, validation)).toBe(true);
    expect(
      Value.Check(aiJudgeConfigurationValidationResultSchema, {
        ...validation,
        issues: [
          {
            ...validation.issues[0],
            target: { type: "scoreGuidance", ref: "B1", score: 1 },
          },
        ],
      }),
    ).toBe(false);
  });

  it("keeps the model from deciding whether semantic validation passed", () => {
    const { passed: _passed, ...modelResult } = validation;

    expect(Value.Check(aiJudgeConfigurationValidatorModelResultSchema, modelResult)).toBe(true);
    expect(Value.Check(aiJudgeConfigurationValidatorModelResultSchema, validation)).toBe(false);
  });

  it("limits Validator output to three actionable findings", () => {
    const { passed: _passed, ...modelResult } = validation;
    const repeatedIssues = Array.from({ length: 4 }, (_, index) => ({
      ...modelResult.issues[0],
      code: `finding_${index}`,
    }));

    expect(
      Value.Check(aiJudgeConfigurationValidatorModelResultSchema, {
        ...modelResult,
        issues: repeatedIssues,
      }),
    ).toBe(false);
  });

  it("accepts independent validation without an original brief", () => {
    expect(
      Value.Check(validateAiJudgeConfigurationInputSchema, {
        courseId,
        lessonContext,
        configuration,
      }),
    ).toBe(true);
  });

  it("describes each real progress stage with stage-specific data", () => {
    expect(
      Value.Check(aiJudgeGenerationProgressEventSchema, {
        status: "evaluating",
        attempt: 1,
        attemptHistory: [],
        draft: referencedConfiguration,
      }),
    ).toBe(true);
    expect(
      Value.Check(aiJudgeGenerationProgressEventSchema, {
        status: "revising",
        attempt: 1,
        attemptHistory: [],
        draft: referencedConfiguration,
        validation,
      }),
    ).toBe(true);
    expect(
      Value.Check(aiJudgeGenerationProgressEventSchema, {
        status: "requires_review",
        attempt: 2,
        attemptHistory: [],
        configuration,
        validation,
      }),
    ).toBe(false);
  });

  it("keeps terminal configurations free from temporary references", () => {
    expect(
      Value.Check(aiJudgeGenerationResultSchema, {
        status: "completed",
        attempt: 2,
        attemptHistory: [],
        configuration,
        validation: { passed: true, summary: "The rubric is coherent.", issues: [] },
      }),
    ).toBe(true);
    expect(
      Value.Check(aiJudgeGenerationResultSchema, {
        status: "completed",
        attempt: 2,
        attemptHistory: [],
        configuration: referencedConfiguration,
        validation: { passed: true, summary: "The rubric is coherent.", issues: [] },
      }),
    ).toBe(false);
  });

  it("allows reconciled persisted identities only in the application result", () => {
    const configurationWithIds = {
      ...configuration,
      criteria: [
        {
          ...configuration.criteria[0],
          id: "87ee9005-970c-45f2-a9b0-5cf642440ff7",
          scoreGuidance: configuration.criteria[0].scoreGuidance.map((guidance, index) => ({
            ...guidance,
            id: `00000000-0000-4000-8000-00000000000${index + 1}`,
          })),
        },
      ],
      blockingErrors: [
        {
          ...configuration.blockingErrors[0],
          id: "00000000-0000-4000-8000-000000000009",
        },
      ],
    };

    expect(
      Value.Check(aiJudgeGenerationApplicationResultSchema, {
        status: "completed",
        attempt: 1,
        attemptHistory: [],
        configuration: configurationWithIds,
        validation: { passed: true, summary: "The rubric is coherent.", issues: [] },
      }),
    ).toBe(true);
    expect(
      Value.Check(aiJudgeGenerationResultSchema, {
        status: "completed",
        attempt: 1,
        attemptHistory: [],
        configuration: configurationWithIds,
        validation: { passed: true, summary: "The rubric is coherent.", issues: [] },
      }),
    ).toBe(false);
  });

  it("wraps temporary progress in a generation-addressable snapshot", () => {
    expect(
      Value.Check(aiJudgeGenerationSnapshotSchema, {
        generationId: "f40c0e4c-4ccb-48a3-b774-1fd710238a01",
        progress: {
          status: "drafting",
          attempt: 1,
          attemptHistory: [],
        },
      }),
    ).toBe(true);
  });
});
