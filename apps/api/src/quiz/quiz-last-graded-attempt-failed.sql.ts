import { ASSESSMENT_ATTEMPT_GRADING_STATUSES, ASSESSMENT_ATTEMPT_RESULTS } from "@repo/shared";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { QueryBuilder } from "drizzle-orm/pg-core";

import { activeLearningState } from "src/course-repetition/course-learning-state.sql";
import { assessmentAttempts, assessments } from "src/storage/schema";

import type { SQLWrapper } from "drizzle-orm";

const queryBuilder = new QueryBuilder();

// Read from the attempt history because starting a retake clears the lesson progress, so a failed
// quiz stays failed until a later attempt passes. Pending, open and cancelled attempts are skipped.
// Graded attempts always carry a score and a grading time; those filters match the partial
// assessment_attempts_report_latest_graded_idx index.
export const quizLastGradedAttemptFailed = (lessonId: SQLWrapper, learnerId: SQLWrapper | string) =>
  sql<boolean>`(${queryBuilder
    .select({ result: assessmentAttempts.result })
    .from(assessmentAttempts)
    .innerJoin(assessments, eq(assessments.id, assessmentAttempts.assessmentId))
    .where(
      and(
        eq(assessments.lessonId, lessonId),
        eq(assessmentAttempts.learnerId, learnerId),
        eq(assessmentAttempts.gradingStatus, ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED),
        isNotNull(assessmentAttempts.scorePercentage),
        isNotNull(assessmentAttempts.gradedAt),
        activeLearningState(assessmentAttempts.learningStateId),
      ),
    )
    .orderBy(desc(assessmentAttempts.attemptNumber))
    .limit(1)}) = ${ASSESSMENT_ATTEMPT_RESULTS.FAILED}`;
