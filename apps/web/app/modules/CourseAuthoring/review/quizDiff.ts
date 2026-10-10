import { BLOCK_DIFF_STATUS } from "./curriculumReview.constants";

import type { Question } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

export type ReviewAnswer = { key: string; text: string; correct: boolean | null };

export type ReviewQuestion = {
  key: string;
  id: string | null;
  type: string;
  title: string;
  prompt: string;
  answers: ReviewAnswer[];
};

export type QuestionDiffEntry =
  | {
      status: typeof BLOCK_DIFF_STATUS.UNCHANGED | typeof BLOCK_DIFF_STATUS.MODIFIED;
      before: ReviewQuestion;
      after: ReviewQuestion;
    }
  | { status: typeof BLOCK_DIFF_STATUS.ADDED; after: ReviewQuestion }
  | { status: typeof BLOCK_DIFF_STATUS.REMOVED; before: ReviewQuestion };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const stripTags = (html: string) =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const proposedQuestion = (value: unknown, index: number): ReviewQuestion | null => {
  if (!isObject(value)) return null;
  const id = text(value.id) || null;
  const options = Array.isArray(value.options) ? value.options.filter(isObject) : [];
  const statements = Array.isArray(value.trueFalseStatements)
    ? value.trueFalseStatements.filter(isObject)
    : [];
  const scale = Array.isArray(value.scaleOptions) ? value.scaleOptions.filter(isObject) : [];
  const answers: ReviewAnswer[] = [
    ...options.map((option, optionIndex) => ({
      key: text(option.id) || `option-${optionIndex}`,
      text: text(option.label) || text(option.optionText) || text(option.text),
      correct: typeof option.isCorrect === "boolean" ? option.isCorrect : null,
    })),
    ...statements.map((statement, statementIndex) => ({
      key: text(statement.id) || `statement-${statementIndex}`,
      text: text(statement.statement),
      correct: typeof statement.correctValue === "boolean" ? statement.correctValue : null,
    })),
    ...scale.map((option, optionIndex) => ({
      key: text(option.id) || `scale-${optionIndex}`,
      text: text(option.label),
      correct: null,
    })),
  ].filter((answer) => answer.text);
  return {
    key: id ?? `proposed-${index}`,
    id,
    type: text(value.questionType) || text(value.type),
    title: text(value.title),
    prompt: stripTags(text(value.prompt) || text(value.description)),
    answers,
  };
};

export const currentQuestion = (question: Question, index: number): ReviewQuestion => ({
  key: question.id ?? `current-${index}`,
  id: question.id ?? null,
  type: question.type,
  title: question.title?.trim() ?? "",
  prompt: stripTags(question.description ?? ""),
  answers: (question.options ?? [])
    .map((option, optionIndex) => ({
      key: option.id ?? `option-${optionIndex}`,
      text: option.optionText?.trim() ?? "",
      correct: option.isCorrect,
    }))
    .filter((answer) => answer.text),
});

const questionSignature = (question: ReviewQuestion) =>
  JSON.stringify([
    question.type,
    question.title,
    question.prompt,
    question.answers.map((answer) => [answer.text, answer.correct]),
  ]);

/** Pairs questions by id first, then by reading order. */
export const diffQuestions = (
  before: ReviewQuestion[],
  after: ReviewQuestion[],
): QuestionDiffEntry[] => {
  const beforeById = new Map(
    before.flatMap((question) => (question.id ? [[question.id, question] as const] : [])),
  );
  const afterIds = new Set(after.flatMap((question) => (question.id ? [question.id] : [])));
  const used = new Set<string>();
  const unmatchedBefore = () => before.filter((question) => !used.has(question.key));
  const entries: QuestionDiffEntry[] = [];
  after.forEach((question) => {
    const byId = question.id ? beforeById.get(question.id) : undefined;
    const match =
      byId ?? unmatchedBefore().find((candidate) => !candidate.id || !afterIds.has(candidate.id));
    if (!match || used.has(match.key)) {
      entries.push({ status: BLOCK_DIFF_STATUS.ADDED, after: question });
      return;
    }
    used.add(match.key);
    entries.push({
      status:
        questionSignature(match) === questionSignature(question)
          ? BLOCK_DIFF_STATUS.UNCHANGED
          : BLOCK_DIFF_STATUS.MODIFIED,
      before: match,
      after: question,
    });
  });
  unmatchedBefore().forEach((question) =>
    entries.push({ status: BLOCK_DIFF_STATUS.REMOVED, before: question }),
  );
  return entries;
};
