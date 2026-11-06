import { ASSESSMENT_ATTEMPT_GRADING_STATUSES } from "@repo/shared";
import { and, eq, exists, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { assessmentAttempts, assessments } from "src/storage/schema";

import type { SQLWrapper } from "drizzle-orm";

const queryBuilder = new QueryBuilder();

// A quiz awaits review while the learner's attempt in the active learning state is still pending.
export const quizAwaitingReview = (lessonId: SQLWrapper, learnerId: SQLWrapper | string) =>
  sql<boolean>`${exists(
    queryBuilder
      .select({ id: assessmentAttempts.id })
      .from(assessmentAttempts)
      .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
      .where(
        and(
          eq(assessments.lessonId, lessonId),
          eq(assessmentAttempts.learnerId, learnerId),
          eq(assessmentAttempts.gradingStatus, ASSESSMENT_ATTEMPT_GRADING_STATUSES.PENDING),
          activeLearningState(assessmentAttempts.learningStateId),
        ),
      ),
  )}`;
