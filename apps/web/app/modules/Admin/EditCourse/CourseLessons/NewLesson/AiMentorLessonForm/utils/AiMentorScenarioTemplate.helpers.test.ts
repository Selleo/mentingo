import { AI_MENTOR_TYPE } from "@repo/shared";
import { beforeEach, describe, expect, it } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";

import {
  AI_MENTOR_SCENARIO_TEMPLATE,
  buildAiMentorScenarioTemplateDraft,
} from "./AiMentorScenarioTemplate.helpers";

describe("AI Mentor scenario templates", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("builds a complete Roleplay, task description, and Judge configuration", () => {
    const draft = buildAiMentorScenarioTemplateDraft(
      AI_MENTOR_SCENARIO_TEMPLATE.SCENARIO_SIMULATION,
      i18next.t,
    );

    expect(draft.taskDescription).toContain("software client's needs");
    expect(draft.aiMentorConfiguration).toMatchObject({
      type: AI_MENTOR_TYPE.ROLEPLAY,
      aiRole: "Prospective software client",
      learnerRole: "Sales representative",
      factsAndConstraints: expect.stringContaining("three months"),
      openingInstruction: expect.stringContaining("software supplier"),
    });
    expect(draft.aiJudgeConfiguration.criteria).toHaveLength(5);
    expect(draft.aiJudgeConfiguration.passingThresholdPercent).toBe(60);
  });

  it("uses Teacher mode for a knowledge-sharing template", () => {
    const draft = buildAiMentorScenarioTemplateDraft(
      AI_MENTOR_SCENARIO_TEMPLATE.KNOWLEDGE_SHARING,
      i18next.t,
    );

    expect(draft.aiMentorConfiguration).toMatchObject({
      type: AI_MENTOR_TYPE.TEACHER,
      expertise: "Time-management coach",
      feedbackGuidance: expect.stringContaining("realistic workplace application"),
      openingInstruction: expect.stringContaining("time-management technique"),
    });
    expect(draft.aiJudgeConfiguration.criteria).toHaveLength(3);
  });
});
