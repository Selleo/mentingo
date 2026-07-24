import { diffAiJudgeConfigurationDrafts } from "./ai-judge-configuration-diff";
import {
  getDeterministicAiJudgeConfigurationValidation,
  normalizeDuplicateAiJudgeConfigurationReferences,
  validateAiJudgeReferenceTransition,
} from "./ai-judge-configuration-draft";
import {
  reconcileAiJudgeConfigurationDraft,
  referenceAiJudgeConfiguration,
} from "./ai-judge-configuration-references";

import type { ReferencedAiJudgeConfiguration } from "../schemas/ai-judge-configuration-generation.schema";
import type { AiJudgeConfigurationInput } from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";

const configuration: AiJudgeConfigurationInput = {
  taskGoal: "Resolve the customer's concern",
  passingThresholdPercent: 70,
  criteria: [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Discovery",
      expectedBehavior: "Asks what the customer needs",
      maxScore: 2,
      scoreGuidance: [
        {
          id: "00000000-0000-4000-8000-000000000011",
          score: 0,
          description: "Does not ask",
          example: null,
        },
        {
          id: "00000000-0000-4000-8000-000000000012",
          score: 1,
          description: "Asks one broad question",
          example: "What do you need?",
        },
        {
          id: "00000000-0000-4000-8000-000000000013",
          score: 2,
          description: "Clarifies the need",
          example: "What outcome matters most?",
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      title: "Recommendation",
      expectedBehavior: "Proposes a suitable next step",
      maxScore: 1,
      scoreGuidance: [
        {
          id: "00000000-0000-4000-8000-000000000021",
          score: 0,
          description: "Offers no next step",
        },
        {
          id: "00000000-0000-4000-8000-000000000022",
          score: 1,
          description: "Offers a relevant next step",
        },
      ],
    },
  ],
  blockingErrors: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      description: "Invents contract terms",
    },
  ],
};

describe("AI Judge configuration references", () => {
  it("assigns compact references and separates persisted identities from model content", () => {
    const result = referenceAiJudgeConfiguration(configuration);

    expect(result.configuration.criteria.map(({ ref }) => ref)).toEqual(["C1", "C2"]);
    expect(result.configuration.blockingErrors.map(({ ref }) => ref)).toEqual(["B1"]);
    expect(result.configuration.criteria[0]).not.toHaveProperty("id");
    expect(result.configuration.criteria[0]?.scoreGuidance[0]).not.toHaveProperty("id");
    expect(result.identities).toEqual({
      criteria: [
        {
          ref: "C1",
          id: "00000000-0000-4000-8000-000000000001",
          scoreGuidance: [
            { score: 0, id: "00000000-0000-4000-8000-000000000011" },
            { score: 1, id: "00000000-0000-4000-8000-000000000012" },
            { score: 2, id: "00000000-0000-4000-8000-000000000013" },
          ],
        },
        {
          ref: "C2",
          id: "00000000-0000-4000-8000-000000000002",
          scoreGuidance: [
            { score: 0, id: "00000000-0000-4000-8000-000000000021" },
            { score: 1, id: "00000000-0000-4000-8000-000000000022" },
          ],
        },
      ],
      blockingErrors: [{ ref: "B1", id: "00000000-0000-4000-8000-000000000101" }],
    });
  });

  it("preserves IDs by reference and score even when output order and wording change", () => {
    const referenced = referenceAiJudgeConfiguration(configuration);
    const [firstCriterion, secondCriterion] = referenced.configuration.criteria;
    if (!firstCriterion || !secondCriterion) throw new Error("Expected criterion fixtures");

    const improved: ReferencedAiJudgeConfiguration = {
      ...referenced.configuration,
      criteria: [
        secondCriterion,
        {
          ...firstCriterion,
          expectedBehavior: "Asks focused questions about the customer's desired outcome",
          scoreGuidance: [...firstCriterion.scoreGuidance].reverse(),
        },
      ],
    };

    const reconciled = reconcileAiJudgeConfigurationDraft(improved, referenced.identities);

    expect(reconciled.criteria[0]?.id).toBe("00000000-0000-4000-8000-000000000002");
    expect(reconciled.criteria[1]?.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(reconciled.criteria[1]?.scoreGuidance.map(({ score, id }) => ({ score, id }))).toEqual([
      { score: 2, id: "00000000-0000-4000-8000-000000000013" },
      { score: 1, id: "00000000-0000-4000-8000-000000000012" },
      { score: 0, id: "00000000-0000-4000-8000-000000000011" },
    ]);
  });

  it("leaves genuinely new nodes ID-free and drops identities for removed nodes", () => {
    const referenced = referenceAiJudgeConfiguration(configuration);
    const firstCriterion = referenced.configuration.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    const changed: ReferencedAiJudgeConfiguration = {
      ...referenced.configuration,
      criteria: [
        firstCriterion,
        {
          ref: "C3",
          title: "Close",
          expectedBehavior: "Confirms the next action",
          maxScore: 1,
          scoreGuidance: [
            { score: 0, description: "Does not confirm the action" },
            { score: 1, description: "Confirms the action" },
          ],
        },
      ],
      blockingErrors: [{ ref: "B2", description: "Promises an impossible deadline" }],
    };

    const reconciled = reconcileAiJudgeConfigurationDraft(changed, referenced.identities);

    expect(reconciled.criteria[0]?.id).toBe("00000000-0000-4000-8000-000000000001");
    expect(reconciled.criteria[1]).not.toHaveProperty("id");
    expect(reconciled.criteria[1]?.scoreGuidance[0]).not.toHaveProperty("id");
    expect(reconciled.blockingErrors[0]).not.toHaveProperty("id");
  });

  it("rejects duplicate references before identities can be attached twice", () => {
    const referenced = referenceAiJudgeConfiguration(configuration);
    const firstCriterion = referenced.configuration.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    expect(() =>
      reconcileAiJudgeConfigurationDraft(
        { ...referenced.configuration, criteria: [firstCriterion, firstCriterion] },
        referenced.identities,
      ),
    ).toThrow("duplicate criterion references");
  });

  it("reassigns duplicate model references without changing assessment content", () => {
    const referenced = referenceAiJudgeConfiguration(configuration).configuration;
    const firstCriterion = referenced.criteria[0];
    const firstBlockingError = referenced.blockingErrors[0];
    if (!firstCriterion || !firstBlockingError) throw new Error("Expected Judge fixtures");

    const normalized = normalizeDuplicateAiJudgeConfigurationReferences(
      {
        ...referenced,
        criteria: [firstCriterion, { ...firstCriterion, title: "Follow-up" }],
        blockingErrors: [
          firstBlockingError,
          { ...firstBlockingError, description: "Promises an impossible deadline" },
        ],
      },
      referenced,
    );

    expect(normalized.criteria.map(({ ref }) => ref)).toEqual(["C1", "C3"]);
    expect(normalized.blockingErrors.map(({ ref }) => ref)).toEqual(["B1", "B2"]);
    expect(normalized.criteria[1]?.title).toBe("Follow-up");
    expect(normalized.blockingErrors[1]?.description).toBe("Promises an impossible deadline");
  });

  it("requires create references to start at one without gaps", () => {
    const referenced = referenceAiJudgeConfiguration(configuration).configuration;
    const firstCriterion = referenced.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    const issues = validateAiJudgeReferenceTransition(undefined, {
      ...referenced,
      criteria: [{ ...firstCriterion, ref: "C2" }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "invalid_new_criterion_ref",
        target: { type: "criterion", ref: "C2" },
      }),
    ]);
  });

  it("allows removal but requires new references to continue after the previous maximum", () => {
    const before = referenceAiJudgeConfiguration(configuration).configuration;
    const firstCriterion = before.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    const validAfter: ReferencedAiJudgeConfiguration = {
      ...before,
      criteria: [{ ...firstCriterion, ref: "C3" }],
    };
    const invalidAfter: ReferencedAiJudgeConfiguration = {
      ...before,
      criteria: [{ ...firstCriterion, ref: "C4" }],
    };

    expect(validateAiJudgeReferenceTransition(before, validAfter)).toEqual([]);
    expect(validateAiJudgeReferenceTransition(before, invalidAfter)).toEqual([
      expect.objectContaining({
        code: "invalid_new_criterion_ref",
        target: { type: "criterion", ref: "C4" },
      }),
    ]);
  });

  it("caps deterministic structural findings to the public validation contract", () => {
    const referenced = referenceAiJudgeConfiguration(configuration).configuration;
    const invalid = {
      ...referenced,
      criteria: referenced.criteria.map((criterion) => ({
        ...criterion,
        scoreGuidance: [
          { score: -1, description: "Invalid low score" },
          { score: -1, description: "Duplicate invalid score" },
          { score: criterion.maxScore + 1, description: "Invalid high score" },
        ],
      })),
    };

    const result = getDeterministicAiJudgeConfigurationValidation(referenced, invalid);

    expect(result?.issues).toHaveLength(3);
  });
});

describe("AI Judge configuration diff", () => {
  it("ignores reorder-only changes", () => {
    const before = referenceAiJudgeConfiguration(configuration).configuration;
    const after: ReferencedAiJudgeConfiguration = {
      ...before,
      criteria: [...before.criteria].reverse(),
      blockingErrors: [...before.blockingErrors].reverse(),
    };

    expect(diffAiJudgeConfigurationDrafts(before, after)).toEqual([]);
  });

  it("ignores whitespace-only text changes but preserves meaningful wording changes", () => {
    const before = referenceAiJudgeConfiguration(configuration).configuration;
    const firstCriterion = before.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    const whitespaceOnly: ReferencedAiJudgeConfiguration = {
      ...before,
      taskGoal: `  ${before.taskGoal}  `,
      criteria: [
        {
          ...firstCriterion,
          expectedBehavior: "Asks   what the customer\nneeds",
        },
        ...before.criteria.slice(1),
      ],
    };
    expect(diffAiJudgeConfigurationDrafts(before, whitespaceOnly)).toEqual([]);

    const meaningfulChange: ReferencedAiJudgeConfiguration = {
      ...before,
      criteria: [
        {
          ...firstCriterion,
          expectedBehavior: "Asks what the customer explicitly needs",
        },
        ...before.criteria.slice(1),
      ],
    };
    expect(diffAiJudgeConfigurationDrafts(before, meaningfulChange)).toEqual([
      expect.objectContaining({
        targetRef: "C1",
        field: "expectedBehavior",
      }),
    ]);
  });

  it("reports exact configuration, criterion, guidance, and blocking-error changes", () => {
    const before = referenceAiJudgeConfiguration(configuration).configuration;
    const firstCriterion = before.criteria[0];
    if (!firstCriterion) throw new Error("Expected criterion fixture");

    const after: ReferencedAiJudgeConfiguration = {
      ...before,
      taskGoal: "Resolve the concern and agree a next step",
      passingThresholdPercent: 80,
      criteria: [
        {
          ...firstCriterion,
          title: "Focused discovery",
          scoreGuidance: [
            { ...firstCriterion.scoreGuidance[0]!, description: "Skips discovery" },
            firstCriterion.scoreGuidance[1]!,
            { score: 3, description: "Fully clarifies priorities" },
          ],
        },
        {
          ref: "C3",
          title: "Close",
          expectedBehavior: "Confirms the next action",
          maxScore: 1,
          scoreGuidance: [
            { score: 0, description: "Does not confirm the action" },
            { score: 1, description: "Confirms the action" },
          ],
        },
      ],
      blockingErrors: [
        { ref: "B1", description: "Invents commercial or contract terms" },
        { ref: "B2", description: "Promises an impossible deadline" },
      ],
    };

    expect(diffAiJudgeConfigurationDrafts(before, after)).toEqual([
      {
        type: "changed",
        targetRef: "configuration",
        field: "taskGoal",
        before: "Resolve the customer's concern",
        after: "Resolve the concern and agree a next step",
      },
      {
        type: "changed",
        targetRef: "configuration",
        field: "passingThresholdPercent",
        before: 70,
        after: 80,
      },
      {
        type: "changed",
        targetRef: "C1",
        field: "title",
        before: "Discovery",
        after: "Focused discovery",
      },
      {
        type: "changed",
        targetRef: "C1",
        score: 0,
        field: "description",
        before: "Does not ask",
        after: "Skips discovery",
      },
      {
        type: "added",
        targetRef: "C1",
        score: 3,
        field: "scoreGuidance",
        after: "Fully clarifies priorities",
      },
      {
        type: "removed",
        targetRef: "C1",
        score: 2,
        field: "scoreGuidance",
        before: "Clarifies the need",
      },
      {
        type: "added",
        targetRef: "C3",
        field: "criterion",
        after: "Close",
      },
      {
        type: "removed",
        targetRef: "C2",
        field: "criterion",
        before: "Recommendation",
      },
      {
        type: "changed",
        targetRef: "B1",
        field: "description",
        before: "Invents contract terms",
        after: "Invents commercial or contract terms",
      },
      {
        type: "added",
        targetRef: "B2",
        field: "blockingError",
        after: "Promises an impossible deadline",
      },
    ]);
  });
});
