import { faker } from "@faker-js/faker";
import { LEARNING_PATH_PROGRESS_STATUSES } from "@repo/shared";
import { sql } from "drizzle-orm";
import { match } from "ts-pattern";

import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { REPORTS_SEED_OUTCOME_CHANCE, REPORTS_SEED_OUTCOMES } from "./reports-seed-data";

import type { ReportsSeedCourse, ReportsSeedOutcome } from "./seed.types";

/** Built in SQL so postgres-js does not encode the JSON object a second time, as a string. */
export function localizedText(value: string) {
  return sql`json_build_object('en', ${value}::text)`;
}

export function pickOutcome(): ReportsSeedOutcome {
  const roll = faker.number.float({ min: 0, max: 1 });
  if (roll < REPORTS_SEED_OUTCOME_CHANCE.completed) return REPORTS_SEED_OUTCOMES.COMPLETED;
  if (roll < REPORTS_SEED_OUTCOME_CHANCE.completed + REPORTS_SEED_OUTCOME_CHANCE.inProgress) {
    return REPORTS_SEED_OUTCOMES.IN_PROGRESS;
  }
  return REPORTS_SEED_OUTCOMES.NOT_STARTED;
}

export function getCompletedLessonCount(
  course: ReportsSeedCourse,
  outcome: ReportsSeedOutcome,
): number {
  return match(outcome)
    .with(REPORTS_SEED_OUTCOMES.COMPLETED, () => course.lessons.length)
    .with(REPORTS_SEED_OUTCOMES.NOT_STARTED, () => 0)
    .otherwise(() => faker.number.int({ min: 1, max: Math.max(1, course.lessons.length - 1) }));
}

export function toCourseProgress(outcome: ReportsSeedOutcome) {
  return match(outcome)
    .with(REPORTS_SEED_OUTCOMES.COMPLETED, () => PROGRESS_STATUSES.COMPLETED)
    .with(REPORTS_SEED_OUTCOMES.IN_PROGRESS, () => PROGRESS_STATUSES.IN_PROGRESS)
    .otherwise(() => PROGRESS_STATUSES.NOT_STARTED);
}

export function toPathProgress(isCompleted: boolean, isStarted: boolean) {
  return match({ isCompleted, isStarted })
    .with({ isCompleted: true }, () => LEARNING_PATH_PROGRESS_STATUSES.COMPLETED)
    .with({ isStarted: true }, () => LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS)
    .otherwise(() => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED);
}
