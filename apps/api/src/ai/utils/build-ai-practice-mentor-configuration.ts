import { randomUUID } from "node:crypto";

import { AI_MENTOR_TYPE } from "@repo/shared";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";

import type { SupportedLanguages } from "@repo/shared";
import type { AiPracticeMentorConfigurationGraph } from "src/ai/ai-practice.types";
import type { UUIDType } from "src/common";
import type { AiMentorRoleplayConfigurationContent } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

export function buildAiPracticeMentorConfiguration(
  practiceSessionId: UUIDType,
  data: AiMentorRoleplayConfigurationContent,
  language: SupportedLanguages,
): AiPracticeMentorConfigurationGraph {
  const configurationId = randomUUID() as UUIDType;
  const localize = (value: string) => buildJsonbField(language, value);
  const localizeOptional = (value?: string | null) => (value == null ? undefined : localize(value));

  return {
    configuration: {
      id: configurationId,
      practiceSessionId,
      type: AI_MENTOR_TYPE.ROLEPLAY,
      openingInstruction: localizeOptional(data.openingInstruction),
      additionalInstructions: localizeOptional(data.additionalInstructions),
    },
    roleplayConfiguration: {
      configurationId,
      scenario: localize(data.scenario),
      aiRole: localize(data.aiRole),
      learnerRole: localize(data.learnerRole),
      characterGoal: localize(data.characterGoal),
      difficulty: data.difficulty,
      factsAndConstraints: localizeOptional(data.factsAndConstraints),
    },
  };
}
