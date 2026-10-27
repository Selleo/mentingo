import { COURSE_LEARNING_STATE_KINDS } from "@repo/shared";
import { and, eq, exists, isNull, notExists, or, sql } from "drizzle-orm";
import { alias, QueryBuilder } from "drizzle-orm/pg-core";

import { courseLearningStates } from "src/storage/schema";

import { courseLearningContext } from "./course-learning-context";

import type { SQLWrapper } from "drizzle-orm";

const queryBuilder = new QueryBuilder();
const learningState = alias(courseLearningStates, "learning_state");
const repetitionState = alias(courseLearningStates, "repetition_state");

// Null remains the current state for legacy fixtures and progress created before enrollment.
export const currentLearningState = (column: SQLWrapper) =>
  sql<boolean>`${or(
    isNull(column),
    exists(
      queryBuilder
        .select({ id: learningState.id })
        .from(learningState)
        .where(
          and(
            eq(learningState.id, column),
            eq(learningState.kind, COURSE_LEARNING_STATE_KINDS.CURRENT),
          ),
        ),
    ),
  )}`;

export const activeLearningState = (column: SQLWrapper) => {
  const expected = courseLearningContext.getStore();
  const matchesExpectedState = expected?.learningStateId
    ? eq(column, expected.learningStateId)
    : isNull(column);
  if (expected?.readOnly) return sql<boolean>`${matchesExpectedState}`;
  return sql<boolean>`${and(
    or(
      isNull(column),
      exists(
        queryBuilder
          .select({ id: learningState.id })
          .from(learningState)
          .where(
            and(
              eq(learningState.id, column),
              or(
                eq(learningState.kind, COURSE_LEARNING_STATE_KINDS.REPETITION),
                notExists(
                  queryBuilder
                    .select({ id: repetitionState.id })
                    .from(repetitionState)
                    .where(
                      and(
                        eq(repetitionState.courseId, learningState.courseId),
                        eq(repetitionState.studentId, learningState.studentId),
                        eq(repetitionState.tenantId, learningState.tenantId),
                        eq(repetitionState.kind, COURSE_LEARNING_STATE_KINDS.REPETITION),
                      ),
                    ),
                ),
              ),
            ),
          ),
      ),
    ),
    expected ? matchesExpectedState : undefined,
  )}`;
};
