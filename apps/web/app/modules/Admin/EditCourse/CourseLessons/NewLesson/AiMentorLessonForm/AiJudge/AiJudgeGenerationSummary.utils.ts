import { AI_JUDGE_DRAFT_CHANGE_FIELD } from "@repo/shared";

import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { AiJudgeGenerationCheck, AiJudgeGenerationChange } from "./aiJudgeConfiguration.types";

export const formatTaskGoalSummary = (value: string) =>
  stripHtmlTags(value.replace(/<\/(?:li|p)>/gi, " "))
    .replace(/\s+/g, " ")
    .trim();

export const formatChangeValue = (value: string | number | null | undefined) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return stripHtmlTags(value);
  return String(value);
};

export const hasVisibleChange = (change: AiJudgeGenerationChange) =>
  formatChangeValue(change.before) !== formatChangeValue(change.after);

export const getChangeFieldLabelKey = (change: AiJudgeGenerationChange) => {
  switch (change.field) {
    case AI_JUDGE_DRAFT_CHANGE_FIELD.TASK_GOAL:
      return "adminCourseView.curriculum.lesson.aiJudge.taskGoal";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.PASSING_THRESHOLD_PERCENT:
      return "adminCourseView.curriculum.lesson.aiJudge.passingThreshold";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.CRITERION:
    case AI_JUDGE_DRAFT_CHANGE_FIELD.TITLE:
      return "adminCourseView.curriculum.lesson.aiJudge.criterionTitle";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.EXPECTED_BEHAVIOR:
      return "adminCourseView.curriculum.lesson.aiJudge.expectedBehavior";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.MAX_SCORE:
      return "adminCourseView.curriculum.lesson.aiJudge.maxScore";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.SCORE_GUIDANCE:
      return "adminCourseView.curriculum.lesson.aiJudge.scoringGuidance";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.DESCRIPTION:
      return change.score === undefined
        ? "adminCourseView.curriculum.lesson.aiJudge.blockingErrors"
        : "adminCourseView.curriculum.lesson.aiJudge.scoreDescription";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.EXAMPLE:
      return "adminCourseView.curriculum.lesson.aiJudge.acceptedExample";
    case AI_JUDGE_DRAFT_CHANGE_FIELD.BLOCKING_ERROR:
      return "adminCourseView.curriculum.lesson.aiJudge.blockingErrors";
  }
};

export const shouldShowChangeFieldLabel = (change: AiJudgeGenerationChange) => {
  if (change.field === AI_JUDGE_DRAFT_CHANGE_FIELD.BLOCKING_ERROR) return false;
  return !(
    change.field === AI_JUDGE_DRAFT_CHANGE_FIELD.DESCRIPTION && change.targetRef.startsWith("B")
  );
};

export const groupChangesByTarget = (changes: AiJudgeGenerationChange[]) => {
  const groups = new Map<string, AiJudgeGenerationChange[]>();
  for (const change of changes) {
    const group = groups.get(change.targetRef) ?? [];
    group.push(change);
    groups.set(change.targetRef, group);
  }
  return Array.from(groups.values());
};

export const groupChecksByTarget = (checks: AiJudgeGenerationCheck[]) => {
  const groups = new Map<string, AiJudgeGenerationCheck[]>();
  for (const check of checks) {
    const key = check.targetRef ?? check.targetTypeLabel ?? check.id;
    const group = groups.get(key) ?? [];
    group.push(check);
    groups.set(key, group);
  }
  return Array.from(groups.values());
};

export const isInternalTargetReference = (targetRef: string | undefined) =>
  targetRef ? /^[CB]\d+$/.test(targetRef) : false;

export const isCriterionTargetReference = (targetRef: string | undefined) =>
  targetRef?.startsWith("C") ?? false;
