import { randomUUID } from "node:crypto";

import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  ASSESSMENT_TEXT_COMPARISON_MODES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguages,
} from "@repo/shared";
import { validate as uuidValidate, v5 as uuidV5 } from "uuid";

import { QUESTION_TYPE } from "src/questions/schema/question.types";

import type {
  QuizAuthoringInput,
  QuizAuthoringQuestion,
  BlankRow,
  ScaleOptionRow,
} from "../types/quiz-authoring.types";
import type { UUIDType } from "src/common";
import type {
  AdminQuestionBody,
  CreateQuizLessonBody,
  UpdateQuizLessonBody,
} from "src/lesson/lesson.schema";

const BLANK_MARKER_REGEX = /<blank-answer-([^>]+)>/g;
const BLANK_MARKER_UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

const toAssessmentQuestionType = (type: AdminQuestionBody["type"]) => {
  return type as (typeof ASSESSMENT_QUESTION_TYPES)[keyof typeof ASSESSMENT_QUESTION_TYPES];
};

const isManualQuestion = (type: AdminQuestionBody["type"]) =>
  type === QUESTION_TYPE.BRIEF_RESPONSE || type === QUESTION_TYPE.DETAILED_RESPONSE;

const isChoiceQuestion = (type: AdminQuestionBody["type"]) =>
  type === QUESTION_TYPE.SINGLE_CHOICE ||
  type === QUESTION_TYPE.MULTIPLE_CHOICE ||
  type === QUESTION_TYPE.PHOTO_QUESTION_SINGLE_CHOICE ||
  type === QUESTION_TYPE.PHOTO_QUESTION_MULTIPLE_CHOICE;

export const mapScaleOptionChanges = (
  existingOptions: ScaleOptionRow[],
  questions: QuizAuthoringQuestion[],
) => {
  const incomingOptions = questions.flatMap((question) =>
    question.scaleOptions.map((option) => ({ ...option, questionId: question.id })),
  );
  const existingById = new Map(existingOptions.map((option) => [option.id, option]));
  const incomingIds = new Set(incomingOptions.map((option) => option.id));

  return {
    optionsToCreate: incomingOptions.filter((option) => !existingById.has(option.id)),
    optionsToUpdate: incomingOptions.filter((option) => existingById.has(option.id)),
    optionsToDelete: existingOptions.filter((option) => !incomingIds.has(option.id)),
  };
};

export const mapBlankChanges = (existingBlanks: BlankRow[], questions: QuizAuthoringQuestion[]) => {
  const incomingBlanks = questions.flatMap((question) =>
    question.blanks.map((blank) => ({
      id: blank.id,
      questionId: question.id,
      textComparisonMode: blank.textComparisonMode,
    })),
  );
  const existingById = new Map(existingBlanks.map((blank) => [blank.id, blank]));
  const incomingIds = new Set(incomingBlanks.map((blank) => blank.id));

  return {
    blanksToCreate: incomingBlanks.filter((blank) => !existingById.has(blank.id)),
    blanksToUpdate: incomingBlanks.filter((blank) => existingById.has(blank.id)),
    blanksToDelete: existingBlanks.filter((blank) => !incomingIds.has(blank.id)),
    blankIdsToSync: incomingBlanks.map((blank) => blank.id),
    answerSetsToCreate: questions.flatMap((question) =>
      question.blanks.flatMap((blank) =>
        blank.answerSets.map((answerSet) => ({ ...answerSet, blankId: blank.id })),
      ),
    ),
  };
};

export const mapLocalizedQuestionChildChanges = <
  ExistingRow extends { id: string; questionId: string; language: string },
  IncomingRow extends { id: string; questionId: string; language: string },
>(
  existingRows: ExistingRow[],
  incomingRows: IncomingRow[],
) => {
  const getRowKey = ({ id, questionId, language }: ExistingRow | IncomingRow) =>
    `${questionId}:${language}:${id}`;

  const existingByKey = new Map(existingRows.map((row) => [getRowKey(row), row]));
  const incomingKeys = new Set(incomingRows.map((row) => getRowKey(row)));

  return {
    rowsToCreate: incomingRows.filter((row) => !existingByKey.has(getRowKey(row))),
    rowsToUpdate: incomingRows.filter((row) => existingByKey.has(getRowKey(row))),
    rowsToDelete: existingRows.filter((row) => !incomingKeys.has(getRowKey(row))),
  };
};

const getBlankMarkerIds = (description: string | null | undefined) =>
  [...(description?.matchAll(BLANK_MARKER_REGEX) ?? [])].map((match) => match[1]);

const getBlankIdMap = (question: AdminQuestionBody) => {
  const markerIds = getBlankMarkerIds(question.description);
  const uniqueMarkerIds = [...new Set(markerIds)];
  return new Map(
    uniqueMarkerIds.map((markerId) => [
      markerId,
      uuidValidate(markerId) ? markerId : uuidV5(markerId, BLANK_MARKER_UUID_NAMESPACE),
    ]),
  );
};

const mapChoiceOptions = (options: AdminQuestionBody["options"]) =>
  (options ?? []).map((option, index) => ({
    id: option.id ?? randomUUID(),
    displayOrder: option.displayOrder ?? index + 1,
    isCorrect: option.isCorrect,
    label: option.optionText,
  }));

const mapTrueFalseStatements = (options: AdminQuestionBody["options"]) =>
  (options ?? []).map((option, index) => ({
    id: option.id ?? randomUUID(),
    displayOrder: option.displayOrder ?? index + 1,
    correctValue: option.isCorrect,
    statement: option.optionText,
  }));

const mapScaleOptions = (options: AdminQuestionBody["options"]) =>
  (options ?? []).map((option, index) => ({
    id: option.id ?? randomUUID(),
    displayOrder: option.displayOrder ?? index + 1,
    scaleValue: option.scaleAnswer ?? index + 1,
    label: option.optionText,
  }));

const mapOpenTextSettings = (type: AdminQuestionBody["type"]) =>
  isManualQuestion(type)
    ? { minimumCharacters: null, maximumCharacters: null, reviewerInstructions: null }
    : null;

const mapBlanks = (question: AdminQuestionBody, blankIdMap: Map<string, string>) => {
  const isFillQuestion =
    question.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT ||
    question.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_DND;

  if (!isFillQuestion) return [];

  return [...blankIdMap.entries()].map(([legacyId, blankId], index) => {
    const option =
      question.options?.find((candidate) => candidate.id === legacyId) ?? question.options?.[index];
    const answer = option?.matchedWord?.trim() || option?.optionText.trim() || "";

    return {
      id: blankId,
      textComparisonMode: ASSESSMENT_TEXT_COMPARISON_MODES.EXACT,
      answerSets: [{ preferredAnswer: answer, acceptedAnswers: [answer] }],
    };
  });
};

const normalizeFillPrompt = (prompt: string, blankIdMap: Map<string, string>) =>
  prompt.replace(BLANK_MARKER_REGEX, (_, legacyId: string) => {
    return `<blank-answer-${blankIdMap.get(legacyId) ?? legacyId}>`;
  });

const mapDragAndDropOptions = (
  options: AdminQuestionBody["options"],
  blankIdMap: Map<string, string>,
) =>
  (options ?? []).map((option, index) => ({
    id: option.id ?? randomUUID(),
    label: option.optionText,
    targetBlankId: blankIdMap.get(option.id ?? "") ?? [...blankIdMap.values()][index] ?? null,
    displayOrder: option.displayOrder ?? index + 1,
  }));

const mapQuestion = (question: AdminQuestionBody, index: number): QuizAuthoringQuestion => {
  const options = question.options ?? [];
  const blankIdMap = getBlankIdMap(question);

  const promptValue = question.description ?? question.title;
  const questionType = toAssessmentQuestionType(question.type);
  const isFillQuestion =
    question.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT ||
    question.type === QUESTION_TYPE.FILL_IN_THE_BLANKS_DND;

  const normalizedPrompt = isFillQuestion
    ? normalizeFillPrompt(promptValue, blankIdMap)
    : promptValue;

  const blanks = mapBlanks(question, blankIdMap);
  const optionsForQuestion = isChoiceQuestion(question.type) ? mapChoiceOptions(options) : [];
  const trueFalseStatements =
    question.type === QUESTION_TYPE.TRUE_OR_FALSE ? mapTrueFalseStatements(options) : [];
  const scaleOptions = question.type === QUESTION_TYPE.SCALE_1_5 ? mapScaleOptions(options) : [];
  const dragAndDropOptions =
    questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND
      ? mapDragAndDropOptions(options, blankIdMap)
      : [];

  return {
    id: question.id ?? randomUUID(),
    questionType,
    displayOrder: question.displayOrder ?? index + 1,
    maximumPoints: "1",
    gradingMode: isManualQuestion(question.type)
      ? ASSESSMENT_GRADING_MODES.MANUAL
      : ASSESSMENT_GRADING_MODES.AUTOMATIC,
    prompt: normalizedPrompt,
    title: question.title,
    description: question.description ?? null,
    photoS3Key: question.photoS3Key ?? null,
    options: optionsForQuestion,
    trueFalseStatements,
    scaleOptions,
    openTextSettings: mapOpenTextSettings(question.type),
    blanks,
    dragAndDropOptions,
  };
};

export const mapLegacyQuizAuthoringInput = (
  data: CreateQuizLessonBody | UpdateQuizLessonBody,
  lessonId?: UUIDType,
  languageOverride?: SupportedLanguages,
): QuizAuthoringInput => {
  const {
    title = "",
    description,
    thresholdScore = 0,
    attemptsLimit = null,
    quizCooldownInHours = null,
    questions,
  } = data;

  const language =
    languageOverride ?? ("language" in data ? data.language : SUPPORTED_LANGUAGES.EN);
  const chapterId = "chapterId" in data ? data.chapterId : undefined;
  const displayOrder = "displayOrder" in data ? data.displayOrder : undefined;

  return {
    lessonId,
    chapterId,
    title,
    description,
    thresholdScore,
    attemptsLimit,
    quizCooldownInHours,
    displayOrder,
    language,
    questions: questions?.map((question, index) => mapQuestion(question, index)),
  };
};
