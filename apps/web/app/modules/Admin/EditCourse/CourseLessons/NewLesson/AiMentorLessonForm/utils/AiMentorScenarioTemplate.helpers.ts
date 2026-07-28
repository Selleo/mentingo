import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
} from "@repo/shared";

import type { AiJudgeConfigurationDraft } from "../AiJudge/aiJudgeConfiguration.types";
import type { AiMentorConfigurationDraft } from "../AiMentorConfiguration/aiMentorConfiguration.types";
import type { TFunction } from "i18next";

export const AI_MENTOR_SCENARIO_TEMPLATE = {
  SCENARIO_SIMULATION: "scenarioSimulation",
  PROBLEM_SOLVING: "problemSolving",
  CREATIVE_TASK: "creativeTask",
  KNOWLEDGE_SHARING: "knowledgeSharing",
} as const;

export type AiMentorScenarioTemplate =
  (typeof AI_MENTOR_SCENARIO_TEMPLATE)[keyof typeof AI_MENTOR_SCENARIO_TEMPLATE];

export const AI_MENTOR_SCENARIO_TEMPLATES = Object.values(AI_MENTOR_SCENARIO_TEMPLATE);

type AiMentorScenarioTemplateDraft = {
  taskDescription: string;
  aiMentorConfiguration: AiMentorConfigurationDraft;
  aiJudgeConfiguration: AiJudgeConfigurationDraft;
};

const LIST_ITEM_PATTERN = /<li>(.*?)<\/li>/gis;

const TEMPLATE_SETTINGS: Record<
  AiMentorScenarioTemplate,
  { criteriaCount: number; passingThresholdPercent: number }
> = {
  scenarioSimulation: { criteriaCount: 5, passingThresholdPercent: 60 },
  problemSolving: { criteriaCount: 5, passingThresholdPercent: 60 },
  creativeTask: { criteriaCount: 4, passingThresholdPercent: 100 },
  knowledgeSharing: { criteriaCount: 3, passingThresholdPercent: 0 },
};

const toPlainText = (value: string) =>
  value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

const buildJudgeConfiguration = (
  template: AiMentorScenarioTemplate,
  t: TFunction,
): AiJudgeConfigurationDraft => {
  const settings = TEMPLATE_SETTINGS[template];
  const expectedBehaviors = Array.from(
    t(
      `adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.conditions.${template}`,
    ).matchAll(LIST_ITEM_PATTERN),
    ([, value]) => toPlainText(value),
  ).filter(Boolean);
  const acceptedExamples = Array.from({ length: settings.criteriaCount }, (_, index) =>
    t(
      `adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.acceptedExamples.${template}.${index}`,
    ),
  );

  return {
    taskGoal: expectedBehaviors.join(" "),
    passingThresholdPercent: settings.passingThresholdPercent,
    criteria: expectedBehaviors.map((expectedBehavior, index) => ({
      title: expectedBehavior,
      expectedBehavior,
      maxScore: 1,
      scoreGuidance: [
        {
          score: 0,
          description: t(
            "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.notMetDescription",
            { expectedBehavior },
          ),
          example: t(
            "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.notMetExample",
            { expectedBehavior },
          ),
        },
        {
          score: 1,
          description: t(
            "adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.scoreGuidance.metDescription",
            { expectedBehavior },
          ),
          example: acceptedExamples[index],
        },
      ],
    })),
    blockingErrors: [
      {
        description: t(
          `adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.blockingErrors.${template}`,
        ),
      },
    ],
  };
};

const buildMentorConfiguration = (
  template: AiMentorScenarioTemplate,
  t: TFunction,
): AiMentorConfigurationDraft => {
  const templateKey = `adminCourseView.curriculum.lesson.aiMentorConfiguration.scenarioTemplates.${template}`;
  const content = t(
    `adminCourseView.curriculum.lesson.other.aiMentorSuggestionExamples.instructions.${template}`,
  );

  switch (template) {
    case AI_MENTOR_SCENARIO_TEMPLATE.SCENARIO_SIMULATION:
    case AI_MENTOR_SCENARIO_TEMPLATE.PROBLEM_SOLVING:
      return {
        type: AI_MENTOR_TYPE.ROLEPLAY,
        aiRole: t(`${templateKey}.aiRole`),
        learnerRole: t(`${templateKey}.learnerRole`),
        scenario: content,
        characterGoal: t(`${templateKey}.characterGoal`),
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        factsAndConstraints: t(`${templateKey}.factsAndConstraints`),
        openingInstruction: t(`${templateKey}.openingInstruction`),
        additionalInstructions: "",
      };
    case AI_MENTOR_SCENARIO_TEMPLATE.CREATIVE_TASK:
      return {
        type: AI_MENTOR_TYPE.TEACHER,
        taskGoal: t(`${templateKey}.taskGoal`),
        expertise: t(`${templateKey}.expertise`),
        contentScope: content,
        teachingStyle: AI_MENTOR_TEACHING_STYLE.GUIDED_DISCOVERY,
        feedbackGuidance: t(`${templateKey}.feedbackGuidance`),
        openingInstruction: t(`${templateKey}.openingInstruction`),
        additionalInstructions: "",
      };
    case AI_MENTOR_SCENARIO_TEMPLATE.KNOWLEDGE_SHARING:
      return {
        type: AI_MENTOR_TYPE.TEACHER,
        taskGoal: t(`${templateKey}.taskGoal`),
        expertise: t(`${templateKey}.expertise`),
        contentScope: content,
        teachingStyle: AI_MENTOR_TEACHING_STYLE.EXPLAIN_AND_PRACTICE,
        feedbackGuidance: t(`${templateKey}.feedbackGuidance`),
        openingInstruction: t(`${templateKey}.openingInstruction`),
        additionalInstructions: "",
      };
  }
};

export const buildAiMentorScenarioTemplateDraft = (
  template: AiMentorScenarioTemplate,
  t: TFunction,
): AiMentorScenarioTemplateDraft => ({
  taskDescription: `<p>${t(
    `adminCourseView.curriculum.lesson.aiMentorConfiguration.scenarioTemplates.${template}.taskDescription`,
  )}</p>`,
  aiMentorConfiguration: buildMentorConfiguration(template, t),
  aiJudgeConfiguration: buildJudgeConfiguration(template, t),
});
