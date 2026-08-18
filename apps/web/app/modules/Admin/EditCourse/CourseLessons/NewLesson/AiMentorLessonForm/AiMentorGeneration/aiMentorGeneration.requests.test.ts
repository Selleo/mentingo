import {
  AI_MENTOR_CONFIGURATION_GENERATION_MODE,
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TYPE,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  buildAiMentorGenerationInput,
  buildAiMentorValidationInput,
} from "./aiMentorGeneration.requests";

import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";

const currentUnsavedConfiguration: AiMentorConfigurationDraft = {
  type: AI_MENTOR_TYPE.ROLEPLAY,
  scenario: "Unsaved scenario from the editor",
  aiRole: "Skeptical customer",
  learnerRole: "Account manager",
  characterGoal: "Get a concrete answer",
  difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.CHALLENGING,
  factsAndConstraints: "Unsaved budget limit",
  openingInstruction: null,
  additionalInstructions: "Unsaved extra guidance",
};

const context = {
  courseId: "4daef842-b80f-4d88-ac3d-bc28b878f8af",
  lessonId: "40b72b40-c4ba-443f-b27b-a8e24af95227",
  lessonContext: {
    title: "Unsaved lesson title",
    taskDescription: "Unsaved task description",
  },
};

describe("AI Mentor authoring requests", () => {
  it("sends Improve the exact current unsaved configuration and its creator-owned type", () => {
    const input = buildAiMentorGenerationInput(context, {
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
      instruction: "Make the resistance more realistic.",
      currentConfiguration: currentUnsavedConfiguration,
    });

    expect(input).toEqual({
      ...context,
      mode: AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE,
      instruction: "Make the resistance more realistic.",
      currentConfiguration: currentUnsavedConfiguration,
    });
    if (input.mode !== AI_MENTOR_CONFIGURATION_GENERATION_MODE.IMPROVE)
      throw new Error("Expected an Improve request");
    expect(input.currentConfiguration).toBe(currentUnsavedConfiguration);
    expect(input.currentConfiguration.type).toBe(AI_MENTOR_TYPE.ROLEPLAY);
  });

  it("validates the exact current unsaved configuration without mutating it", () => {
    const before = structuredClone(currentUnsavedConfiguration);
    const input = buildAiMentorValidationInput(context, currentUnsavedConfiguration);

    expect(input).toEqual({ ...context, configuration: before });
    expect(input.configuration).toBe(currentUnsavedConfiguration);
    expect(currentUnsavedConfiguration).toEqual(before);
  });
});
