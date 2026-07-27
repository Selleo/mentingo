import { describe, expect, it } from "vitest";

import {
  createEmptyAiJudgeConfiguration,
  createEmptyCriterion,
  isAiJudgeCriterionComplete,
  reconcileScoreGuidance,
} from "./aiJudgeConfiguration.defaults";
import { aiJudgeConfigurationSchema } from "./aiJudgeConfiguration.schema";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;
const createGuidance = (maxScore: number) =>
  Array.from({ length: maxScore + 1 }, (_, score) => ({
    score,
    description: `Guidance for score ${score}`,
  }));

const createValidConfiguration = () => ({
  taskGoal: "Handle the client conversation and agree on a next step.",
  passingThresholdPercent: 70,
  criteria: [
    {
      title: "Discovers needs",
      expectedBehavior: "Asks at least two relevant discovery questions.",
      maxScore: 5,
      scoreGuidance: createGuidance(5),
    },
    {
      title: "Responds to concerns",
      expectedBehavior: "Acknowledges the concern before proposing a response.",
      maxScore: 3,
      scoreGuidance: createGuidance(3),
    },
    {
      title: "Agrees a next step",
      expectedBehavior: "Ends with a specific mutually agreed action.",
      maxScore: 2,
      scoreGuidance: createGuidance(2),
    },
  ],
  blockingErrors: [{ description: "Invents a contractual guarantee." }],
});

describe("aiJudgeConfigurationSchema", () => {
  it("starts without invented criteria", () => {
    expect(createEmptyAiJudgeConfiguration().criteria).toEqual([]);
  });

  it("accepts a complete structured configuration", () => {
    expect(aiJudgeConfigurationSchema(t).safeParse(createValidConfiguration()).success).toBe(true);
  });

  it("accepts the API-supported zero passing threshold", () => {
    const configuration = createValidConfiguration();
    configuration.passingThresholdPercent = 0;

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(true);
  });

  it("rejects a task goal containing only empty rich-text markup", () => {
    const configuration = createValidConfiguration();
    configuration.taskGoal = "<p><br></p>";

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });

  it("allows a configuration without criteria while it is being drafted", () => {
    const configuration = createValidConfiguration();
    configuration.criteria = [];

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(true);
  });

  it("derives exact score guidance and preserves matching values", () => {
    const guidance = reconcileScoreGuidance(3, [
      { score: 0, description: "Not met", example: undefined },
      { score: 2, description: "Partially met", example: "Example" },
      { score: 5, description: "Outside the new range", example: undefined },
    ]);

    expect(guidance.map(({ score }) => score)).toEqual([0, 1, 2, 3]);
    expect(guidance[2]).toEqual({
      score: 2,
      description: "Partially met",
      example: "Example",
    });
    expect(guidance.some(({ score }) => score === 5)).toBe(false);
  });

  it("marks a criterion complete only when every exact score level is described", () => {
    const criterion = createEmptyCriterion();
    criterion.title = "Discovers needs";
    criterion.expectedBehavior = "Asks relevant questions";

    expect(isAiJudgeCriterionComplete(criterion)).toBe(false);

    criterion.scoreGuidance = reconcileScoreGuidance(criterion.maxScore, []).map((guidance) => ({
      ...guidance,
      description: `Guidance for ${guidance.score}`,
    }));

    expect(isAiJudgeCriterionComplete(criterion)).toBe(true);
  });

  it("rejects guidance above the criterion maximum", () => {
    const configuration = createValidConfiguration();
    configuration.criteria[0].scoreGuidance[5].score = 6;

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });

  it("rejects a criterion maximum score above five", () => {
    const configuration = createValidConfiguration();
    configuration.criteria[0].maxScore = 6;
    configuration.criteria[0].scoreGuidance = createGuidance(6);

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });

  it("rejects duplicate guidance scores within one criterion", () => {
    const configuration = createValidConfiguration();
    configuration.criteria[0].scoreGuidance[1].score = 0;

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });

  it("rejects a criterion without score guidance", () => {
    const configuration = createValidConfiguration();
    configuration.criteria[0].scoreGuidance = [];

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });

  it("rejects guidance that omits an intermediate score", () => {
    const configuration = createValidConfiguration();
    configuration.criteria[0].scoreGuidance = configuration.criteria[0].scoreGuidance.filter(
      ({ score }) => score !== 3,
    );

    expect(aiJudgeConfigurationSchema(t).safeParse(configuration).success).toBe(false);
  });
});
