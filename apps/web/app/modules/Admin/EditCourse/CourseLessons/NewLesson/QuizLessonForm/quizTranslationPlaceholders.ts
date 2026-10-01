import { BLANK_ANSWER_MARKER_REGEX } from "~/utils/blankAnswerMarkers";

import { getBaseLanguageTextPlaceholder } from "../../../utils/baseLanguageText";

import type { Question, QuestionOption } from "./QuizLessonForm.types";

export const findBaseLanguageQuestion = (
  baseLanguageQuestions: Question[] | undefined,
  question: Question,
  questionIndex: number,
) =>
  baseLanguageQuestions?.find(
    (baseLanguageQuestion) => Boolean(question.id) && baseLanguageQuestion.id === question.id,
  ) ?? baseLanguageQuestions?.[questionIndex];

export const findBaseLanguageOption = (
  baseLanguageQuestion: Question | undefined,
  currentOptions: QuestionOption[],
  option: QuestionOption,
  optionIndex: number,
) => {
  const optionOccurrence = currentOptions
    .slice(0, optionIndex)
    .filter(({ displayOrder }) => displayOrder === option.displayOrder).length;

  const matchingBaseOptions = baseLanguageQuestion?.options?.filter(
    ({ displayOrder }) => displayOrder === option.displayOrder,
  );

  return matchingBaseOptions?.[optionOccurrence] ?? baseLanguageQuestion?.options?.[optionIndex];
};

export const getBaseLanguageFillPromptPreview = (question: Question | undefined) => {
  if (!question?.description) return null;

  const optionTextById = new Map(
    question.options?.map((option) => [option.id, option.optionText] as const) ?? [],
  );
  const promptWithAnswers = question.description.replace(
    BLANK_ANSWER_MARKER_REGEX,
    (_, answerId: string) => ` ${optionTextById.get(answerId) ?? "_____"} `,
  );

  return getBaseLanguageTextPlaceholder(promptWithAnswers) ?? null;
};
