import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import { aiMentorConfigurationSchema } from "./aiMentorConfiguration.schema";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;

describe("aiMentorConfigurationSchema", () => {
  it("accepts a complete Teacher configuration", () => {
    const result = aiMentorConfigurationSchema(t).safeParse({
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "Help the learner explain the escalation process.",
      expertise: "Customer support coach",
      contentScope: "Use the company escalation policy.",
      teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a complete Roleplay configuration", () => {
    const result = aiMentorConfigurationSchema(t).safeParse({
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "A customer questions an unexpected invoice.",
      aiRole: "Concerned customer",
      learnerRole: "Support representative",
      characterGoal: "Receive a clear explanation and next step.",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
    });

    expect(result.success).toBe(true);
  });

  it("rejects incomplete and mixed mode fields", () => {
    const result = aiMentorConfigurationSchema(t).safeParse({
      type: AI_MENTOR_TYPE.TEACHER,
      scenario: "A roleplay scenario",
      aiRole: "Customer",
      learnerRole: "Representative",
      characterGoal: "Resolve the issue",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
    });

    expect(result.success).toBe(false);
  });

  it("rejects visually empty rich-text fields", () => {
    const result = aiMentorConfigurationSchema(t).safeParse({
      type: AI_MENTOR_TYPE.TEACHER,
      expertise: "Customer support coach",
      taskGoal: "<p><br></p>",
      contentScope: "<p>Use the company escalation policy.</p>",
      teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
    });

    expect(result.success).toBe(false);
  });
});
