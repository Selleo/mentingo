import {
  AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE,
  type AiMentorConfigurationField,
} from "@repo/shared";

import { getAiMentorConfigurationFields } from "./ai-mentor-configuration-draft";

import type {
  AiMentorConfigurationDraft,
  AiMentorConfigurationDraftChange,
} from "../schemas/ai-mentor-configuration-generation.schema";
import type { AiMentorConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export const diffAiMentorConfigurationDrafts = (
  before: AiMentorConfigurationDraft,
  after: AiMentorConfigurationContent,
): AiMentorConfigurationDraftChange[] => {
  if (before.type !== after.type)
    throw new Error("AI Mentor configuration type cannot change during generation");

  return getAiMentorConfigurationFields(after.type).flatMap((field) => {
    const beforeValue = getFieldValue(before, field);
    const afterValue = getFieldValue(after, field);
    if (beforeValue === afterValue) return [];

    return [
      {
        type: getChangeType(beforeValue, afterValue),
        field,
        before: beforeValue,
        after: afterValue,
      },
    ];
  });
};

const getFieldValue = (
  configuration: AiMentorConfigurationDraft | AiMentorConfigurationContent,
  field: AiMentorConfigurationField,
): string | null => {
  switch (field) {
    case "taskGoal":
      return configuration.type === "teacher" ? (configuration.taskGoal ?? null) : null;
    case "expertise":
      return configuration.type === "teacher" ? (configuration.expertise ?? null) : null;
    case "contentScope":
      return configuration.type === "teacher" ? (configuration.contentScope ?? null) : null;
    case "teachingStyle":
      return configuration.type === "teacher" ? (configuration.teachingStyle ?? null) : null;
    case "feedbackGuidance":
      return configuration.type === "teacher" ? (configuration.feedbackGuidance ?? null) : null;
    case "scenario":
      return configuration.type === "roleplay" ? (configuration.scenario ?? null) : null;
    case "aiRole":
      return configuration.type === "roleplay" ? (configuration.aiRole ?? null) : null;
    case "learnerRole":
      return configuration.type === "roleplay" ? (configuration.learnerRole ?? null) : null;
    case "characterGoal":
      return configuration.type === "roleplay" ? (configuration.characterGoal ?? null) : null;
    case "difficulty":
      return configuration.type === "roleplay" ? (configuration.difficulty ?? null) : null;
    case "factsAndConstraints":
      return configuration.type === "roleplay" ? (configuration.factsAndConstraints ?? null) : null;
    case "openingInstruction":
      return configuration.openingInstruction ?? null;
    case "additionalInstructions":
      return configuration.additionalInstructions ?? null;
  }
};

const getChangeType = (before: string | null, after: string | null) => {
  if (before === null && after !== null) return AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE.ADDED;
  if (before !== null && after === null) return AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE.REMOVED;
  return AI_MENTOR_CONFIGURATION_DRAFT_CHANGE_TYPE.CHANGED;
};
