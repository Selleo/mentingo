import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_STATUSES,
  COURSE_ENROLLMENT,
} from "@repo/shared";
import { subDays } from "date-fns";

import {
  assessmentAttempts,
  certificates,
  studentCourses,
  studentLessonProgress,
} from "../storage/schema";

import {
  REPORTS_SEED_CERTIFICATE_CHANCE,
  REPORTS_SEED_ENROLLED_DAYS_AGO,
  REPORTS_SEED_QUIZ_ATTEMPTS,
  REPORTS_SEED_QUIZ_PASS_PERCENT,
  REPORTS_SEED_QUIZ_SCORE,
  REPORTS_SEED_OUTCOMES,
} from "./reports-seed-data";
import { getCompletedLessonCount, toCourseProgress } from "./reports-seed.utils";

import type { ReportsSeedCourse, ReportsSeedOutcome } from "./seed.types";
import type { DatabasePg, UUIDType } from "../common";

export async function enrollLearner(
  db: DatabasePg,
  tenantId: UUIDType,
  learnerId: UUIDType,
  course: ReportsSeedCourse,
  plannedOutcome: ReportsSeedOutcome,
) {
  const outcome = course.idleDays === null ? REPORTS_SEED_OUTCOMES.NOT_STARTED : plannedOutcome;
  const latestActivityAt = subDays(new Date(), course.idleDays ?? 0);
  const enrolledAt = faker.date.recent({
    days: faker.number.int(REPORTS_SEED_ENROLLED_DAYS_AGO),
    refDate: latestActivityAt,
  });
  const completedLessonCount = getCompletedLessonCount(course, outcome);
  const completedAt =
    outcome === REPORTS_SEED_OUTCOMES.COMPLETED
      ? faker.date.between({ from: enrolledAt, to: latestActivityAt })
      : null;
  const lastOpenedAt =
    outcome === REPORTS_SEED_OUTCOMES.NOT_STARTED
      ? null
      : (completedAt ?? faker.date.between({ from: enrolledAt, to: latestActivityAt }));

  const [enrollment] = await db
    .insert(studentCourses)
    .values({
      studentId: learnerId,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      progress: toCourseProgress(outcome),
      enrolledAt: enrolledAt.toISOString(),
      completedAt: completedAt?.toISOString() ?? null,
      lastOpenedAt: lastOpenedAt?.toISOString() ?? null,
      tenantId,
    })
    .onConflictDoNothing()
    .returning({ id: studentCourses.id });
  if (!enrollment) return;

  const completedLessons = course.lessons.slice(0, completedLessonCount);
  if (completedLessons.length) {
    await db.insert(studentLessonProgress).values(
      completedLessons.map((lesson) => ({
        studentId: learnerId,
        lessonId: lesson.id,
        chapterId: lesson.chapterId,
        isStarted: true,
        completedAt: faker.date
          .between({ from: enrolledAt, to: completedAt ?? latestActivityAt })
          .toISOString(),
        tenantId,
      })),
    );
  }

  await createQuizAttempts(db, tenantId, learnerId, completedLessons, enrolledAt, latestActivityAt);
  if (outcome === REPORTS_SEED_OUTCOMES.COMPLETED && completedAt) {
    await createCertificate(db, tenantId, learnerId, course.id, completedAt);
  }
}

async function createQuizAttempts(
  db: DatabasePg,
  tenantId: UUIDType,
  learnerId: UUIDType,
  completedLessons: ReportsSeedCourse["lessons"],
  enrolledAt: Date,
  latestActivityAt: Date,
) {
  const attempts = completedLessons.flatMap(({ assessmentId }) => {
    if (!assessmentId) return [];

    const attemptCount = faker.number.int(REPORTS_SEED_QUIZ_ATTEMPTS);
    return Array.from({ length: attemptCount }, (_, index) => {
      const scorePercentage = faker.number.int(REPORTS_SEED_QUIZ_SCORE);
      const submittedAt = faker.date.between({ from: enrolledAt, to: latestActivityAt });
      return {
        assessmentId,
        learnerId,
        language: "en" as const,
        attemptNumber: index + 1,
        submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
        result:
          scorePercentage >= REPORTS_SEED_QUIZ_PASS_PERCENT
            ? ASSESSMENT_ATTEMPT_RESULTS.PASSED
            : ASSESSMENT_ATTEMPT_RESULTS.FAILED,
        availablePoints: "100",
        awardedPoints: String(scorePercentage),
        scorePercentage: String(scorePercentage),
        startedAt: submittedAt.toISOString(),
        submittedAt: submittedAt.toISOString(),
        gradedAt: submittedAt.toISOString(),
        tenantId,
      };
    });
  });

  if (attempts.length) await db.insert(assessmentAttempts).values(attempts).onConflictDoNothing();
}

async function createCertificate(
  db: DatabasePg,
  tenantId: UUIDType,
  learnerId: UUIDType,
  courseId: UUIDType,
  completedAt: Date,
) {
  if (!faker.datatype.boolean(REPORTS_SEED_CERTIFICATE_CHANCE.issued)) return;

  const isExpired = faker.datatype.boolean(REPORTS_SEED_CERTIFICATE_CHANCE.expired);
  await db.insert(certificates).values({
    userId: learnerId,
    courseId,
    status: isExpired ? CERTIFICATE_STATUSES.ARCHIVED : CERTIFICATE_STATUSES.ACTIVE,
    issuedAt: completedAt.toISOString(),
    expiresAt: isExpired ? faker.date.recent({ days: 10 }).toISOString() : null,
    archiveReason: isExpired ? CERTIFICATE_ARCHIVE_REASONS.EXPIRED : null,
    archivedAt: isExpired ? new Date().toISOString() : null,
    tenantId,
  });
}
