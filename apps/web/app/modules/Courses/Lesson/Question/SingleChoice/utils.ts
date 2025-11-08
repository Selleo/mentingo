import type { QuizQuestionOption } from "../types";

export const getOptionConfig = (option: QuizQuestionOption, isAdmin: boolean) => {
  const isFieldDisabled = isAdmin || typeof option.isCorrect === "boolean";
  const isCorrectAnswer = Boolean(typeof option.isCorrect === "boolean" && option.isStudentAnswer);
  const isWrongAnswer = Boolean(!option.isCorrect && option.isStudentAnswer);
  const isCorrectAnswerNotSelected = option.isCorrect && !option.isStudentAnswer;

  return {
    isFieldDisabled,
    isWrongAnswer,
    isCorrectAnswerNotSelected,
    isCorrectAnswer: option.isCorrect,
    isCorrectAnswerSelected: isCorrectAnswer,
    isStudentAnswer: Boolean(option.isStudentAnswer),
    isPreviewMode: isAdmin,
  };
};
