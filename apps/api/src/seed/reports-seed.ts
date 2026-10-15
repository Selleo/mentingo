import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  CERTIFICATE_ARCHIVE_REASONS,
  CERTIFICATE_STATUSES,
  COURSE_ENROLLMENT,
  LEARNING_PATH_ENROLLMENT_TYPES,
  LEARNING_PATH_PROGRESS_STATUSES,
  LEARNING_PATH_STATUSES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import * as dotenv from "dotenv";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { sampleSize } from "lodash";
import postgres from "postgres";
import { match } from "ts-pattern";

import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import {
  assessmentAttempts,
  assessments,
  certificates,
  chapters,
  courses,
  groupUsers,
  groups,
  learningPathCourses,
  learningPaths,
  lessons,
  studentCourses,
  studentLearningPathCourses,
  studentLearningPaths,
  studentLessonProgress,
  tenants,
  users,
} from "../storage/schema";

import {
  REPORTS_SEED_CERTIFICATE_CHANCE,
  REPORTS_SEED_ENROLLED_DAYS_AGO,
  REPORTS_SEED_ENROLLMENTS_PER_LEARNER,
  REPORTS_SEED_GROUPS,
  REPORTS_SEED_LEARNER_COUNT,
  REPORTS_SEED_MARKER_EMAIL,
  REPORTS_SEED_OUTCOME_CHANCE,
  REPORTS_SEED_PATH,
  REPORTS_SEED_QUIZ_ATTEMPTS,
  REPORTS_SEED_QUIZ_PASS_PERCENT,
  REPORTS_SEED_QUIZ_SCORE,
  REPORTS_SEED_RANDOM_SEED,
} from "./reports-seed-data";
import { addEmailSuffix, assignSystemRoleToUser, getTenantEmailSuffix } from "./seed-helpers";

import type { ReportsSeedCourse, ReportsSeedOutcome } from "./seed.types";
import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

/**
 * Adds report demo data on top of tenants that were already seeded with `pnpm db:seed`:
 * learners in groups, enrollments with lesson progress, graded quiz attempts, certificates
 * and one development path. Nothing is deleted; a tenant that already has the data is skipped.
 */
async function seedReports() {
  faker.seed(REPORTS_SEED_RANDOM_SEED);

  try {
    for (const origin of getTenantOrigins()) {
      await seedTenant(origin);
    }
  } finally {
    await sqlConnect.end();
  }
}

async function seedTenant(origin: string) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.host, origin));
  if (!tenant) {
    console.log(`⏭️  ${origin}: tenant not found, run pnpm db:seed first`);
    return;
  }

  const emailSuffix = getTenantEmailSuffix(origin);
  const [alreadySeeded] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, addEmailSuffix(REPORTS_SEED_MARKER_EMAIL, emailSuffix)));
  if (alreadySeeded) {
    console.log(`⏭️  ${origin}: report data already seeded`);
    return;
  }

  const seedCourses = await findPublishedCourses(tenant.id);
  if (!seedCourses.length) {
    console.log(`⏭️  ${origin}: no published courses to enroll learners in`);
    return;
  }

  const learnerIds = await createLearners(tenant.id, emailSuffix);
  const groupIdsByName = await createGroups(tenant.id, learnerIds);

  for (const learnerId of learnerIds) {
    const enrollmentCount = faker.number.int(REPORTS_SEED_ENROLLMENTS_PER_LEARNER);
    for (const course of sampleSize(seedCourses, enrollmentCount)) {
      await enrollLearner(tenant.id, learnerId, course, pickOutcome());
    }
  }

  const pathLearnerIds = await findGroupMembers(
    tenant.id,
    groupIdsByName.get(REPORTS_SEED_PATH.groupName),
  );
  await createDevelopmentPath(tenant.id, seedCourses, pathLearnerIds);

  console.log(
    `✅ ${origin}: ${learnerIds.length} learners in ${groupIdsByName.size} groups with enrollments, progress, quiz attempts and certificates`,
  );
}

async function findPublishedCourses(tenantId: UUIDType): Promise<ReportsSeedCourse[]> {
  const publishedCourses = await db
    .select({ id: courses.id, authorId: courses.authorId })
    .from(courses)
    .where(
      and(
        eq(courses.tenantId, tenantId),
        eq(courses.isArchived, false),
        ne(courses.status, "draft"),
      ),
    )
    .orderBy(asc(courses.createdAt));
  if (!publishedCourses.length) return [];

  const courseLessons = await db
    .select({
      id: lessons.id,
      chapterId: lessons.chapterId,
      courseId: chapters.courseId,
      assessmentId: assessments.id,
    })
    .from(lessons)
    .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
    .leftJoin(assessments, eq(assessments.lessonId, lessons.id))
    .where(
      and(
        eq(lessons.tenantId, tenantId),
        inArray(
          chapters.courseId,
          publishedCourses.map(({ id }) => id),
        ),
      ),
    )
    .orderBy(asc(chapters.displayOrder), asc(lessons.displayOrder));

  return publishedCourses
    .map((course) => ({
      ...course,
      lessons: courseLessons.filter(({ courseId }) => courseId === course.id),
    }))
    .filter(({ lessons: courseLessonList }) => courseLessonList.length > 0);
}

async function createLearners(tenantId: UUIDType, emailSuffix: string): Promise<UUIDType[]> {
  const learnerIds: UUIDType[] = [];

  for (let index = 1; index <= REPORTS_SEED_LEARNER_COUNT; index++) {
    const [learner] = await db
      .insert(users)
      .values({
        email: addEmailSuffix(`user+reports+${index}@example.com`, emailSuffix),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        tenantId,
      })
      .returning({ id: users.id });
    await assignSystemRoleToUser(db, learner.id, tenantId, SYSTEM_ROLE_SLUGS.STUDENT);
    learnerIds.push(learner.id);
  }

  return learnerIds;
}

/** Spreads learners across the groups; every fifth learner also joins a second group. */
async function createGroups(
  tenantId: UUIDType,
  learnerIds: UUIDType[],
): Promise<Map<string, UUIDType>> {
  const groupIdsByName = new Map<string, UUIDType>();

  for (const name of REPORTS_SEED_GROUPS) {
    const [group] = await db
      .insert(groups)
      .values({ name: localizedText(name), tenantId })
      .returning({ id: groups.id });
    groupIdsByName.set(name, group.id);
  }

  const groupIds = [...groupIdsByName.values()];
  const memberships = learnerIds.flatMap((userId, index) => {
    const primaryGroupId = groupIds[index % groupIds.length];
    const secondGroupId = groupIds[(index + 1) % groupIds.length];
    return index % 5 === 0
      ? [
          { userId, groupId: primaryGroupId, tenantId },
          { userId, groupId: secondGroupId, tenantId },
        ]
      : [{ userId, groupId: primaryGroupId, tenantId }];
  });
  await db.insert(groupUsers).values(memberships);

  return groupIdsByName;
}

async function findGroupMembers(
  tenantId: UUIDType,
  groupId: UUIDType | undefined,
): Promise<UUIDType[]> {
  if (!groupId) return [];

  const members = await db
    .select({ userId: groupUsers.userId })
    .from(groupUsers)
    .where(and(eq(groupUsers.tenantId, tenantId), eq(groupUsers.groupId, groupId)));
  return members.map(({ userId }) => userId);
}

async function enrollLearner(
  tenantId: UUIDType,
  learnerId: UUIDType,
  course: ReportsSeedCourse,
  outcome: ReportsSeedOutcome,
) {
  const enrolledAt = faker.date.recent({ days: faker.number.int(REPORTS_SEED_ENROLLED_DAYS_AGO) });
  const completedLessonCount = getCompletedLessonCount(course, outcome);
  const completedAt =
    outcome === "completed" ? faker.date.between({ from: enrolledAt, to: new Date() }) : null;
  const lastOpenedAt =
    outcome === "notStarted" ? null : (completedAt ?? faker.date.recent({ days: 45 }));

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
          .between({ from: enrolledAt, to: completedAt ?? new Date() })
          .toISOString(),
        tenantId,
      })),
    );
  }

  await createQuizAttempts(tenantId, learnerId, completedLessons, enrolledAt);
  if (outcome === "completed" && completedAt) {
    await createCertificate(tenantId, learnerId, course.id, completedAt);
  }
}

async function createQuizAttempts(
  tenantId: UUIDType,
  learnerId: UUIDType,
  completedLessons: ReportsSeedCourse["lessons"],
  enrolledAt: Date,
) {
  const attempts = completedLessons.flatMap(({ assessmentId }) => {
    if (!assessmentId) return [];

    const attemptCount = faker.number.int(REPORTS_SEED_QUIZ_ATTEMPTS);
    return Array.from({ length: attemptCount }, (_, index) => {
      const scorePercentage = faker.number.int(REPORTS_SEED_QUIZ_SCORE);
      const submittedAt = faker.date.between({ from: enrolledAt, to: new Date() });
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

/** One published path over the first courses, with every member of one group enrolled. */
async function createDevelopmentPath(
  tenantId: UUIDType,
  seedCourses: ReportsSeedCourse[],
  learnerIds: UUIDType[],
) {
  const pathCourses = seedCourses.slice(0, REPORTS_SEED_PATH.courseCount);
  const [path] = await db
    .insert(learningPaths)
    .values({
      title: localizedText(REPORTS_SEED_PATH.title),
      description: localizedText(REPORTS_SEED_PATH.description),
      status: LEARNING_PATH_STATUSES.PUBLISHED,
      authorId: pathCourses[0].authorId,
      tenantId,
    })
    .returning({ id: learningPaths.id });

  await db.insert(learningPathCourses).values(
    pathCourses.map((course, index) => ({
      learningPathId: path.id,
      courseId: course.id,
      displayOrder: index + 1,
      tenantId,
    })),
  );

  for (const learnerId of learnerIds) {
    const outcomes = pathCourses.map(() => pickOutcome());
    for (const [index, course] of pathCourses.entries()) {
      await enrollLearner(tenantId, learnerId, course, outcomes[index]);
    }

    const isCompleted = outcomes.every((outcome) => outcome === "completed");
    const isStarted = outcomes.some((outcome) => outcome !== "notStarted");
    await db.insert(studentLearningPaths).values({
      studentId: learnerId,
      learningPathId: path.id,
      progress: toPathProgress(isCompleted, isStarted),
      completedAt: isCompleted ? new Date().toISOString() : null,
      enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
      tenantId,
    });
    await db.insert(studentLearningPathCourses).values(
      pathCourses.map((course) => ({
        studentId: learnerId,
        learningPathId: path.id,
        courseId: course.id,
        tenantId,
      })),
    );
  }
}

/** Built in SQL so postgres-js does not encode the JSON object a second time, as a string. */
function localizedText(value: string) {
  return sql`json_build_object('en', ${value}::text)`;
}

function pickOutcome(): ReportsSeedOutcome {
  const roll = faker.number.float({ min: 0, max: 1 });
  if (roll < REPORTS_SEED_OUTCOME_CHANCE.completed) return "completed";
  if (roll < REPORTS_SEED_OUTCOME_CHANCE.completed + REPORTS_SEED_OUTCOME_CHANCE.inProgress) {
    return "inProgress";
  }
  return "notStarted";
}

function getCompletedLessonCount(course: ReportsSeedCourse, outcome: ReportsSeedOutcome): number {
  return match(outcome)
    .with("completed", () => course.lessons.length)
    .with("notStarted", () => 0)
    .otherwise(() => faker.number.int({ min: 1, max: Math.max(1, course.lessons.length - 1) }));
}

function toCourseProgress(outcome: ReportsSeedOutcome) {
  return match(outcome)
    .with("completed", () => PROGRESS_STATUSES.COMPLETED)
    .with("inProgress", () => PROGRESS_STATUSES.IN_PROGRESS)
    .otherwise(() => PROGRESS_STATUSES.NOT_STARTED);
}

function toPathProgress(isCompleted: boolean, isStarted: boolean) {
  return match({ isCompleted, isStarted })
    .with({ isCompleted: true }, () => LEARNING_PATH_PROGRESS_STATUSES.COMPLETED)
    .with({ isStarted: true }, () => LEARNING_PATH_PROGRESS_STATUSES.IN_PROGRESS)
    .otherwise(() => LEARNING_PATH_PROGRESS_STATUSES.NOT_STARTED);
}

function getTenantOrigins(): string[] {
  const devTenantOrigins = (process.env.DEV_TENANT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (devTenantOrigins.length) return devTenantOrigins;

  return [process.env.CORS_ORIGIN].filter((origin): origin is string => Boolean(origin));
}

if (require.main === module) {
  seedReports()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Report seeding failed:", error);
      process.exit(1);
    });
}

export default seedReports;
