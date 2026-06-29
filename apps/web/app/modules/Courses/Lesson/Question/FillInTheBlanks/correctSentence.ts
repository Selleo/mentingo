import { escape } from "lodash-es";

import {
  normalizeBlankAnswerLineBreaks,
  splitByBlankAnswerMarkers,
} from "~/utils/blankAnswerMarkers";

import type { QuizQuestion, QuizQuestionOption } from "../types";

const findOptionForBlank = (
  options: QuizQuestionOption[],
  answerId: string,
  legacyCorrectOptions: QuizQuestionOption[],
) => {
  const optionById = options.find((option) => option.id === answerId);
  if (optionById?.optionText) return optionById;

  const displayOrder = Number(answerId);
  if (!Number.isInteger(displayOrder)) return null;

  return (
    legacyCorrectOptions.find((option) => option.displayOrder === displayOrder) ??
    legacyCorrectOptions[displayOrder - 1] ??
    null
  );
};

export const getCorrectSentence = (question: QuizQuestion) => {
  const storedSolutionExplanation = question.solutionExplanation?.trim();
  if (storedSolutionExplanation) return storedSolutionExplanation;

  if (!question.description || !question.options?.length) return null;

  const options = question.options;
  const legacyCorrectOptions = options
    .filter((option) => option.isCorrect)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const parts = splitByBlankAnswerMarkers(normalizeBlankAnswerLineBreaks(question.description));
  const blankCount = parts.filter((part) => part.answerId).length;
  let replacedBlankCount = 0;

  const content = parts
    .map((part) => {
      if (!part.answerId) return part.text;

      const option = findOptionForBlank(options, part.answerId, legacyCorrectOptions);
      if (!option?.optionText) return part.text;

      replacedBlankCount += 1;
      return `${part.text}<strong>${escape(option.optionText)}</strong>`;
    })
    .join("");

  return replacedBlankCount > 0 && replacedBlankCount === blankCount ? content : null;
};
