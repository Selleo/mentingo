import { ASSESSMENT_QUESTION_TYPES } from "@repo/shared";

import { getBlankMarkerIds, replaceBlankMarkerIds } from "./quiz-authoring-mapper.utils";

import type {
  QuizAuthoringLocalizedQuestion,
  QuizAuthoringQuestion,
} from "../types/quiz-authoring.types";

type OrderedConfiguration = {
  id: string;
  displayOrder: number;
};

const preserveOrderedConfigurationIds = <Incoming extends OrderedConfiguration>(
  incomingConfigurations: Incoming[],
  existingConfigurations: OrderedConfiguration[],
) => {
  const existingById = new Map(
    existingConfigurations.map((configuration) => [configuration.id, configuration]),
  );
  const existingByDisplayOrder = new Map(
    existingConfigurations.map((configuration) => [configuration.displayOrder, configuration]),
  );
  const preservedIds = new Set<string>();

  return incomingConfigurations.map((incomingConfiguration) => {
    const matchingConfiguration =
      existingById.get(incomingConfiguration.id) ??
      existingByDisplayOrder.get(incomingConfiguration.displayOrder);

    if (!matchingConfiguration || preservedIds.has(matchingConfiguration.id)) {
      return incomingConfiguration;
    }

    preservedIds.add(matchingConfiguration.id);
    return { ...incomingConfiguration, id: matchingConfiguration.id };
  });
};

const getPreservedBlankIdMap = (
  incomingQuestion: QuizAuthoringQuestion,
  existingQuestion: QuizAuthoringLocalizedQuestion,
) => {
  const incomingBlankIds = getBlankMarkerIds(incomingQuestion.prompt);
  const existingBlankIdsInPrompt = getBlankMarkerIds(existingQuestion.prompt);
  const existingBlankIds = new Set(existingQuestion.blanks.map(({ id }) => id));
  const preservedBlankIds = new Set<string>();
  const preservedBlankIdByIncomingId = new Map<string, string>();

  incomingBlankIds.forEach((incomingBlankId, index) => {
    if (preservedBlankIdByIncomingId.has(incomingBlankId)) return;

    const matchingBlankId = existingBlankIds.has(incomingBlankId)
      ? incomingBlankId
      : existingBlankIdsInPrompt[index];

    if (!matchingBlankId || !existingBlankIds.has(matchingBlankId)) return;
    if (preservedBlankIds.has(matchingBlankId)) return;

    preservedBlankIds.add(matchingBlankId);
    preservedBlankIdByIncomingId.set(incomingBlankId, matchingBlankId);
  });

  return preservedBlankIdByIncomingId;
};

const preserveDragAndDropOptionIds = (
  incomingQuestion: QuizAuthoringQuestion,
  existingQuestion: QuizAuthoringLocalizedQuestion,
  preservedBlankIdByIncomingId: Map<string, string>,
) => {
  const existingById = new Map(
    existingQuestion.dragAndDropOptions.map((option) => [option.id, option]),
  );
  const existingByTargetBlankId = new Map(
    existingQuestion.dragAndDropOptions
      .filter((option) => option.targetBlankId)
      .map((option) => [option.targetBlankId!, option]),
  );
  const existingByDisplayOrder = new Map(
    existingQuestion.dragAndDropOptions.map((option) => [option.displayOrder, option]),
  );
  const preservedOptionIds = new Set<string>();

  return incomingQuestion.dragAndDropOptions.map((incomingOption) => {
    const preservedTargetBlankId = incomingOption.targetBlankId
      ? (preservedBlankIdByIncomingId.get(incomingOption.targetBlankId) ??
        incomingOption.targetBlankId)
      : null;
    const matchingOption =
      existingById.get(incomingOption.id) ??
      (preservedTargetBlankId ? existingByTargetBlankId.get(preservedTargetBlankId) : undefined) ??
      existingByDisplayOrder.get(incomingOption.displayOrder) ??
      existingQuestion.dragAndDropOptions.find(
        (existingOption) => existingOption.label === incomingOption.label,
      );

    if (!matchingOption || preservedOptionIds.has(matchingOption.id)) {
      return { ...incomingOption, targetBlankId: preservedTargetBlankId };
    }

    preservedOptionIds.add(matchingOption.id);
    return {
      ...incomingOption,
      id: matchingOption.id,
      targetBlankId: preservedTargetBlankId,
    };
  });
};

const preserveFillQuestionIds = (
  incomingQuestion: QuizAuthoringQuestion,
  existingQuestion: QuizAuthoringLocalizedQuestion,
) => {
  const preservedBlankIdByIncomingId = getPreservedBlankIdMap(incomingQuestion, existingQuestion);

  return {
    ...incomingQuestion,
    prompt: replaceBlankMarkerIds(incomingQuestion.prompt, preservedBlankIdByIncomingId),
    description:
      incomingQuestion.description === null
        ? null
        : replaceBlankMarkerIds(incomingQuestion.description, preservedBlankIdByIncomingId),
    blanks: incomingQuestion.blanks.map((blank) => ({
      ...blank,
      id: preservedBlankIdByIncomingId.get(blank.id) ?? blank.id,
    })),
    dragAndDropOptions: preserveDragAndDropOptionIds(
      incomingQuestion,
      existingQuestion,
      preservedBlankIdByIncomingId,
    ),
  };
};

const preserveQuestionConfigurationIds = (
  incomingQuestion: QuizAuthoringQuestion,
  existingQuestion: QuizAuthoringLocalizedQuestion,
): QuizAuthoringQuestion => {
  if (incomingQuestion.questionType !== existingQuestion.questionType) return incomingQuestion;

  const questionWithPreservedOrderedConfigurationIds = {
    ...incomingQuestion,
    options: preserveOrderedConfigurationIds(incomingQuestion.options, existingQuestion.options),
    trueFalseStatements: preserveOrderedConfigurationIds(
      incomingQuestion.trueFalseStatements,
      existingQuestion.trueFalseStatements,
    ),
    scaleOptions: preserveOrderedConfigurationIds(
      incomingQuestion.scaleOptions,
      existingQuestion.scaleOptions,
    ),
  };

  const isFillQuestion =
    incomingQuestion.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT ||
    incomingQuestion.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND;

  return isFillQuestion
    ? preserveFillQuestionIds(questionWithPreservedOrderedConfigurationIds, existingQuestion)
    : questionWithPreservedOrderedConfigurationIds;
};

export const preserveExistingQuizAuthoringIds = (
  incomingQuestions: QuizAuthoringQuestion[],
  existingQuestions: QuizAuthoringLocalizedQuestion[],
) => {
  const existingByQuestionId = new Map(
    existingQuestions.map((question) => [question.id, question]),
  );

  return incomingQuestions.map((incomingQuestion) => {
    const existingQuestion = existingByQuestionId.get(incomingQuestion.id);

    return existingQuestion
      ? preserveQuestionConfigurationIds(incomingQuestion, existingQuestion)
      : incomingQuestion;
  });
};
