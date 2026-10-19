import { sql } from "drizzle-orm";

import { courseLearningContext } from "./course-learning-context";

import type { SQLWrapper } from "drizzle-orm";

// Null remains the current state for legacy fixtures and progress created before enrollment.
export const currentLearningState = (column: SQLWrapper) => sql<boolean>`(
  ${column} IS NULL OR EXISTS (
    SELECT 1 FROM course_learning_states cls
    WHERE cls.id = ${column} AND cls.kind = 'current'
  )
)`;

export const activeLearningState = (column: SQLWrapper) => {
  const expected = courseLearningContext.getStore();
  if (expected?.readOnly)
    return sql<boolean>`${column} IS NOT DISTINCT FROM ${expected.learningStateId}::uuid`;
  return sql<boolean>`(
  ${column} IS NULL OR EXISTS (
    SELECT 1 FROM course_learning_states cls
    WHERE cls.id = ${column} AND (
      cls.kind = 'repetition' OR NOT EXISTS (
        SELECT 1 FROM course_learning_states repeat_state
        WHERE repeat_state.course_id = cls.course_id
          AND repeat_state.student_id = cls.student_id
          AND repeat_state.tenant_id = cls.tenant_id
          AND repeat_state.kind = 'repetition'
      )
    )
)
) AND ${expected ? sql`${column} IS NOT DISTINCT FROM ${expected.learningStateId}::uuid` : sql`TRUE`}`;
};
