import { getExactLocalizedText } from "src/localization/localization.utils";

import type { AiMentorConfigurationGraph } from "../types/ai-mentor-configuration.types";
import type { SupportedLanguages } from "@repo/shared";

export const needsAiMentorConfiguration = (
  graph: AiMentorConfigurationGraph,
  baseLanguage: SupportedLanguages,
): boolean => {
  const requiredValues = graph.teacherConfiguration
    ? [
        graph.teacherConfiguration.taskGoal,
        graph.teacherConfiguration.expertise,
        graph.teacherConfiguration.contentScope,
      ]
    : [
        graph.roleplayConfiguration?.scenario,
        graph.roleplayConfiguration?.aiRole,
        graph.roleplayConfiguration?.learnerRole,
        graph.roleplayConfiguration?.characterGoal,
      ];

  return requiredValues.some((value) => !getExactLocalizedText(value, baseLanguage)?.trim().length);
};

export const hasMissingAiMentorConfigurationTranslations = (
  graph: AiMentorConfigurationGraph,
  language: SupportedLanguages,
  baseLanguage: SupportedLanguages,
): boolean => {
  if (language === baseLanguage) return false;

  const localizedValues = [
    graph.configuration.openingInstruction,
    graph.configuration.additionalInstructions,
    ...(graph.teacherConfiguration
      ? [
          graph.teacherConfiguration.taskGoal,
          graph.teacherConfiguration.expertise,
          graph.teacherConfiguration.contentScope,
          graph.teacherConfiguration.feedbackGuidance,
        ]
      : []),
    ...(graph.roleplayConfiguration
      ? [
          graph.roleplayConfiguration.scenario,
          graph.roleplayConfiguration.aiRole,
          graph.roleplayConfiguration.learnerRole,
          graph.roleplayConfiguration.characterGoal,
          graph.roleplayConfiguration.factsAndConstraints,
        ]
      : []),
  ];

  return localizedValues.some((value) => {
    const base = getExactLocalizedText(value, baseLanguage);
    const translated = getExactLocalizedText(value, language);

    return Boolean(base?.length && !translated?.length);
  });
};
