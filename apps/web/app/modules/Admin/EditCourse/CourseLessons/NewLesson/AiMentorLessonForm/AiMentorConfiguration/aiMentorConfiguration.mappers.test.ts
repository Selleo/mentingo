import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  mapAiMentorConfigurationDraftToBaseInput,
  mapAiMentorConfigurationDraftToTranslationInput,
  mapAiMentorConfigurationResponseToDraft,
} from "./aiMentorConfiguration.mappers";

import type { AiMentorConfigurationResponse } from "./aiMentorConfiguration.types";
const commonResponse = {
  id: "00000000-0000-4000-8000-000000000001",
  aiMentorLessonId: "00000000-0000-4000-8000-000000000002",
  needsConfiguration: false,
  hasMissingTranslations: false,
  language: "en",
  baseLanguage: "en",
  availableLocales: ["en", "pl"],
} satisfies Pick<
  AiMentorConfigurationResponse,
  | "id"
  | "aiMentorLessonId"
  | "needsConfiguration"
  | "hasMissingTranslations"
  | "language"
  | "baseLanguage"
  | "availableLocales"
>;

describe("AI Mentor configuration mappers", () => {
  it("maps and normalizes a Teacher configuration", () => {
    const response = {
      ...commonResponse,
      type: AI_MENTOR_TYPE.TEACHER,
      taskGoal: "Teach escalation",
      expertise: "Support coach",
      contentScope: "Escalation policy",
      teachingStyle: AI_MENTOR_TEACHING_STYLE.EXPLAIN_AND_PRACTICE,
      feedbackGuidance: null,
      openingInstruction: null,
      additionalInstructions: null,
    } satisfies AiMentorConfigurationResponse;

    const draft = mapAiMentorConfigurationResponseToDraft(response);
    if (draft.type !== AI_MENTOR_TYPE.TEACHER) throw new Error("Expected Teacher draft");

    expect(draft.feedbackGuidance).toBe("");
    expect(
      mapAiMentorConfigurationDraftToBaseInput({
        ...draft,
        taskGoal: "  Teach escalation  ",
        openingInstruction: "  ",
      }),
    ).toMatchObject({
      taskGoal: "Teach escalation",
      openingInstruction: null,
    });
  });

  it("excludes structural Roleplay fields from a translation update", () => {
    const response = {
      ...commonResponse,
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "Invoice discussion",
      aiRole: "Concerned customer",
      learnerRole: "Support representative",
      characterGoal: "Understand the charge",
      difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.CHALLENGING,
      factsAndConstraints: "The invoice is correct.",
      openingInstruction: null,
      additionalInstructions: null,
    } satisfies AiMentorConfigurationResponse;

    const translation = mapAiMentorConfigurationDraftToTranslationInput(
      mapAiMentorConfigurationResponseToDraft(response),
    );

    expect(translation).toEqual({
      type: AI_MENTOR_TYPE.ROLEPLAY,
      scenario: "Invoice discussion",
      aiRole: "Concerned customer",
      learnerRole: "Support representative",
      characterGoal: "Understand the charge",
      factsAndConstraints: "The invoice is correct.",
      openingInstruction: null,
      additionalInstructions: null,
    });
    expect(translation).not.toHaveProperty("difficulty");
  });
});
