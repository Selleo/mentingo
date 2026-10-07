import { ASSESSMENT_QUESTION_TYPES } from "@repo/shared";

import { getBlankMarkerIds } from "../mappers/quiz-authoring-mapper.utils";

import type { QuizAuthoringQuestion } from "../types/quiz-authoring.types";

export const validateCanonicalQuizQuestions = (questions: QuizAuthoringQuestion[]): string[] => {
  const issues: string[] = [];
  const seen = new Set<string>();
  for (const question of questions) {
    if (seen.has(question.id)) issues.push("duplicate_question_id");
    seen.add(question.id);
    if (!Number.isFinite(Number(question.maximumPoints)) || Number(question.maximumPoints) <= 0)
      issues.push("invalid_maximum_points");
    const children = [
      ...question.options,
      ...question.trueFalseStatements,
      ...question.scaleOptions,
      ...question.blanks,
      ...question.dragAndDropOptions,
    ];
    const childIds = children.map((child) => child.id);
    if (new Set(childIds).size !== childIds.length) issues.push("duplicate_question_child_id");
    const choice = [
      ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
      ASSESSMENT_QUESTION_TYPES.MULTIPLE_CHOICE,
      ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_SINGLE_CHOICE,
      ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_MULTIPLE_CHOICE,
    ].some((type) => type === question.questionType);
    const single =
      question.questionType === ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE ||
      question.questionType === ASSESSMENT_QUESTION_TYPES.PHOTO_QUESTION_SINGLE_CHOICE;
    if (choice) {
      const correct = question.options.filter((option) => option.isCorrect).length;
      if (question.options.length < 2 || correct === 0 || (single && correct !== 1))
        issues.push("invalid_choice_answers");
    } else if (question.options.length) issues.push("unexpected_choice_options");
    if (question.questionType === ASSESSMENT_QUESTION_TYPES.TRUE_OR_FALSE) {
      if (!question.trueFalseStatements.length) issues.push("missing_statements");
    } else if (question.trueFalseStatements.length) issues.push("unexpected_statements");
    if (question.questionType === ASSESSMENT_QUESTION_TYPES.SCALE_1_5) {
      const values = new Set(question.scaleOptions.map((option) => option.scaleValue));
      if (question.scaleOptions.length !== 5 || [1, 2, 3, 4, 5].some((value) => !values.has(value)))
        issues.push("invalid_scale");
    } else if (question.scaleOptions.length) issues.push("unexpected_scale_options");
    const blankQuestion =
      question.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_TEXT ||
      question.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND;
    if (blankQuestion) {
      const markers = new Set(getBlankMarkerIds(question.prompt));
      if (
        !question.blanks.length ||
        markers.size !== question.blanks.length ||
        question.blanks.some((blank) => !markers.has(blank.id))
      )
        issues.push("invalid_blank_markers");
      if (
        question.blanks.some(
          (blank) =>
            !blank.answerSets.length ||
            blank.answerSets.some(
              (set) => !set.preferredAnswer.trim() || !set.acceptedAnswers.length,
            ),
        )
      )
        issues.push("missing_blank_answers");
    } else if (question.blanks.length) issues.push("unexpected_blanks");
    if (question.questionType === ASSESSMENT_QUESTION_TYPES.FILL_IN_THE_BLANKS_DND) {
      const blankIds = new Set(question.blanks.map((blank) => blank.id));
      if (
        question.dragAndDropOptions.some(
          (option) => option.targetBlankId !== null && !blankIds.has(option.targetBlankId),
        ) ||
        question.blanks.some(
          (blank) =>
            !question.dragAndDropOptions.some((option) => option.targetBlankId === blank.id),
        )
      )
        issues.push("invalid_drag_targets");
    } else if (question.dragAndDropOptions.length) issues.push("unexpected_drag_options");
    const open =
      question.questionType === ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE ||
      question.questionType === ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE;
    if (open && question.openTextSettings === null) issues.push("missing_open_text_settings");
    if (!open && question.openTextSettings !== null) issues.push("unexpected_open_text_settings");
    const settings = question.openTextSettings;
    if (
      settings?.minimumCharacters !== null &&
      settings?.maximumCharacters !== null &&
      settings?.minimumCharacters !== undefined &&
      settings?.maximumCharacters !== undefined &&
      settings.minimumCharacters > settings.maximumCharacters
    )
      issues.push("invalid_character_limits");
  }
  return [...new Set(issues)];
};
