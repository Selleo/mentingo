import { match } from "ts-pattern";

import type { CompetencyReviewItem } from "../competencies.types";
import type { TFunction } from "i18next";
export const REVIEW_FILTERS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  REVOKED: "revoked",
} as const;

export type ReviewFilter = (typeof REVIEW_FILTERS)[keyof typeof REVIEW_FILTERS];

export const REVIEW_PAGE_SIZE = 10;

export function getReviewSubjectName(item: CompetencyReviewItem, t: TFunction) {
  return item.subjectName ?? t("competencies.archivedAccount");
}

export function getReviewConditions(item: CompetencyReviewItem, t: TFunction) {
  return item.conditions.map((condition) => ({
    condition,
    levelLabel: t("competencies.numberedLevel", {
      number: condition.levelNumber,
      name: condition.levelName,
    }),
  }));
}

export function getReviewStatusVariant(status: CompetencyReviewItem["status"]) {
  return match(status)
    .with(REVIEW_FILTERS.PENDING, () => "inProgress" as const)
    .with(REVIEW_FILTERS.APPROVED, () => "success" as const)
    .otherwise(() => "notStarted" as const);
}

export function getReviewDecisions(item: CompetencyReviewItem) {
  return match(item.status)
    .with(REVIEW_FILTERS.PENDING, () => ["rejected", "approved"] as const)
    .with(REVIEW_FILTERS.APPROVED, () => ["revoked"] as const)
    .otherwise(() => [] as const);
}
