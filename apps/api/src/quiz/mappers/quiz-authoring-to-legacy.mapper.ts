import { LESSON_TYPES } from "@repo/shared";

import type {
  QuizAuthoringLocalizedQuestion,
  QuizAuthoringLocalizedReadModel,
} from "../types/quiz-authoring.types";
import type { AdminQuestionBody, AdminLessonWithContentSchema } from "src/lesson/lesson.schema";

const buildSolutionExplanation = (question: QuizAuthoringLocalizedQuestion) => {
  const correctAnswers = [
    ...question.options.filter((option) => option.isCorrect).map((option) => option.label),
    ...question.trueFalseStatements
      .filter((statement) => statement.correctValue)
      .map((statement) => statement.statement),
    ...question.blanks
      .map((blank) => blank.answerSets[0]?.preferredAnswer)
      .filter((answer): answer is string => Boolean(answer)),
  ].filter(Boolean);

  if (!correctAnswers.length) return undefined;

  return `Correct answer: ${correctAnswers.join(", ")}`;
};

const mapTargetQuestionToLegacy = (question: QuizAuthoringLocalizedQuestion): AdminQuestionBody => {
  const solutionExplanation = buildSolutionExplanation(question);

  const options: NonNullable<AdminQuestionBody["options"]> = question.options.map((option) => ({
    id: option.id,
    optionText: option.label,
    displayOrder: option.displayOrder,
    isCorrect: option.isCorrect,
    matchedWord: null,
    scaleAnswer: null,
  }));

  if (question.trueFalseStatements.length) {
    options.push(
      ...question.trueFalseStatements.map((statement) => ({
        id: statement.id,
        optionText: statement.statement,
        displayOrder: statement.displayOrder,
        isCorrect: statement.correctValue,
        matchedWord: null,
        scaleAnswer: null,
      })),
    );
  }

  if (question.scaleOptions.length) {
    options.push(
      ...question.scaleOptions.map((option) => ({
        id: option.id,
        optionText: option.label,
        displayOrder: option.displayOrder,
        isCorrect: false,
        matchedWord: null,
        scaleAnswer: option.scaleValue,
      })),
    );
  }

  if (question.blanks.length) {
    options.push(
      ...question.blanks.map((blank, index) => {
        const answer = blank.answerSets[0]?.preferredAnswer ?? "";
        return {
          id: blank.id,
          optionText: answer,
          displayOrder: index + 1,
          isCorrect: true,
          matchedWord: answer || null,
          scaleAnswer: null,
        };
      }),
    );
  }

  if (question.dragAndDropOptions.length) {
    options.push(
      ...question.dragAndDropOptions.map((option) => ({
        id: option.id,
        optionText: option.label,
        displayOrder: option.displayOrder,
        isCorrect: false,
        matchedWord: null,
        scaleAnswer: null,
      })),
    );
  }

  return {
    id: question.id,
    type: question.questionType as AdminQuestionBody["type"],
    title: question.title,
    description: question.description ?? question.prompt,
    displayOrder: question.displayOrder,
    ...(solutionExplanation ? { solutionExplanation } : {}),
    photoS3Key: question.photoS3Key,
    options,
  };
};

function parseAttemptCooldown(cooldown: string | null) {
  if (!cooldown) return null;

  const hours = cooldown.match(/([\d.]+)\s+hours?/i);
  if (hours) return Number(hours[1]);

  const days = cooldown.match(/([\d.]+)\s+days?/i);
  return days ? Number(days[1]) * 24 : null;
}

export const mapLocalizedQuizAuthoringReadModelToLegacy = (
  model: QuizAuthoringLocalizedReadModel,
): AdminLessonWithContentSchema => ({
  ...model.lesson,
  type: LESSON_TYPES.QUIZ,
  displayOrder: model.lesson.displayOrder ?? 0,
  description: model.lesson.description ?? "",
  thresholdScore: Number(model.assessment.passingScorePercentage),
  attemptsLimit: model.assessment.maximumAttempts,
  quizCooldownInHours: parseAttemptCooldown(model.assessment.attemptCooldown),
  questions: model.questions.map(mapTargetQuestionToLegacy),
  aiMentor: null,
});
