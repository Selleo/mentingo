import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { addDays, format, subMonths } from "date-fns";
import * as dotenv from "dotenv";
import { and, count, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { flatMap, sampleSize } from "lodash";
import postgres from "postgres";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_ADMIN_SETTINGS,
  DEFAULT_STUDENT_SETTINGS,
} from "src/settings/constants/settings.constants";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import hashPassword from "../common/helpers/hashPassword";
import {
  chapters,
  courses,
  coursesSummaryStats,
  courseStudentsStats,
  credentials,
  groupCourses,
  groups,
  groupUsers,
  lessonLearningTime,
  lessons,
  questions,
  quizAttempts,
  settings,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  userDetails,
  userOnboarding,
  users,
} from "../storage/schema";

import { e2eCourses } from "./e2e-data-seeds";
import { niceCourses } from "./nice-data-seeds";
import {
  addEmailSuffix,
  assignSystemRoleToUser,
  createNiceCourses,
  ensureSeedTenant,
  getTenantEmailSuffix,
  refreshSeedSearchDocuments,
  seedSystemRolesForTenant,
  seedTruncateAllTables,
  seedUserRoleGrantSql,
} from "./seed-helpers";
import { admin, contentCreators, students, trainers } from "./users-seed";

import type { UsersSeed } from "./seed.types";
import type { DatabasePg, UUIDType } from "../common";
import type { GlobalSettingsJSONContentSchema } from "src/settings/schemas/settings.schema";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

async function createUsers(
  users: UsersSeed,
  tenantId: UUIDType,
  password = faker.internet.password(),
  emailSuffix?: string,
) {
  return Promise.all(
    users.map(async (userData) => {
      const baseEmail = userData.email || faker.internet.email();
      const email = addEmailSuffix(baseEmail, emailSuffix);
      const userToCreate = {
        id: faker.string.uuid(),
        email,
        firstName: userData.firstName || faker.person.firstName(),
        lastName: userData.lastName || faker.person.lastName(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      };

      const user = await createOrFindUser(userToCreate.email, password, userToCreate, tenantId);
      await assignSystemRoleToUser(
        db,
        user.id,
        tenantId,
        userData.roleSlug ?? SYSTEM_ROLE_SLUGS.STUDENT,
      );

      await insertUserSettings(
        db,
        user.id,
        tenantId,
        (userData.roleSlug ?? SYSTEM_ROLE_SLUGS.STUDENT) === SYSTEM_ROLE_SLUGS.ADMIN,
      );

      return user;
    }),
  );
}

async function createOrFindUser(
  email: string,
  password: string,
  userData: any,
  tenantId: UUIDType,
) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) return existingUser;

  const [newUser] = await db.insert(users).values(userData).returning();

  await insertCredential(newUser.id, tenantId, password);
  await insertOnboardingData(newUser.id, tenantId);

  await insertUserDetails(newUser.id, tenantId);

  return newUser;
}

async function insertCredential(userId: UUIDType, tenantId: UUIDType, password: string) {
  const credentialData = {
    id: faker.string.uuid(),
    userId,
    password: await hashPassword(password),
    requiresPasswordChange: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId,
  };
  return (await db.insert(credentials).values(credentialData).returning())[0];
}

export async function insertOnboardingData(userId: UUIDType, tenantId: UUIDType) {
  return await db.insert(userOnboarding).values({
    userId,
    tenantId,
  });
}

async function insertUserDetails(userId: UUIDType, tenantId: UUIDType) {
  return await db.insert(userDetails).values({
    userId,
    description: faker.lorem.paragraph(3),
    contactEmail: faker.internet.email(),
    contactPhoneNumber: faker.phone.number(),
    jobTitle: faker.person.jobTitle(),
    tenantId,
  });
}

export async function insertGlobalSettings(database: DatabasePg, tenantId: UUIDType) {
  const [createdGlobalSettings] = await database
    .insert(settings)
    .values({
      settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
      tenantId,
    })
    .returning({
      id: settings.id,
      settings: sql<GlobalSettingsJSONContentSchema>`settings.settings`,
    });

  return createdGlobalSettings;
}

export async function insertUserSettings(
  database: DatabasePg,
  userId: UUIDType,
  tenantId: UUIDType,
  isAdmin: boolean,
) {
  const [existingUserSettings] = await database
    .select()
    .from(settings)
    .where(and(eq(settings.userId, userId), eq(settings.tenantId, tenantId)));

  if (existingUserSettings) return existingUserSettings;

  const settingsObject = isAdmin ? DEFAULT_ADMIN_SETTINGS : DEFAULT_STUDENT_SETTINGS;
  const [createdUserSettings] = await database
    .insert(settings)
    .values({
      userId,
      settings: settingsToJSONBuildObject(settingsObject),
      tenantId,
    })
    .returning();

  return createdUserSettings;
}

async function createStudentCourses(courses: any[], studentIds: UUIDType[], tenantId: UUIDType) {
  const getStudentCourseProgress = (course: any) => {
    const progressSeed = faker.number.int({ min: 1, max: 100 });

    if (progressSeed <= 20) {
      return {
        completedAt: null,
        finishedChapterCount: 0,
        progress: PROGRESS_STATUSES.NOT_STARTED,
      };
    }

    if (progressSeed <= 80) {
      return {
        completedAt: null,
        finishedChapterCount: faker.number.int({
          min: 0,
          max: Math.max((course.chapterCount ?? 1) - 1, 0),
        }),
        progress: PROGRESS_STATUSES.IN_PROGRESS,
      };
    }

    return {
      completedAt: faker.date.recent({ days: 90 }).toISOString(),
      finishedChapterCount: course.chapterCount ?? 0,
      progress: PROGRESS_STATUSES.COMPLETED,
    };
  };

  const studentsCoursesList = studentIds.flatMap((studentId) => {
    const courseCount = Math.floor(courses.length * 0.5);
    const selectedCourses = sampleSize(courses, courseCount);

    return selectedCourses.map((course) => {
      const courseProgress = getStudentCourseProgress(course);

      return {
        id: faker.string.uuid(),
        studentId: studentId,
        courseId: course.id,
        completedAt: courseProgress.completedAt,
        finishedChapterCount: courseProgress.finishedChapterCount,
        numberOfAssignments: faker.number.int({ min: 0, max: 10 }),
        numberOfFinishedAssignments: faker.number.int({ min: 0, max: 10 }),
        progress: courseProgress.progress,
        archived: false,
        enrolledByGroupId: null,
        status: COURSE_ENROLLMENT.ENROLLED,
        createdAt: course.createdAt,
        updatedAt: course.updatedAt,
        tenantId,
      };
    });
  });

  return db.insert(studentCourses).values(studentsCoursesList).returning();
}

async function createDeadlineGroups(
  courseList: any[],
  studentIds: UUIDType[],
  enrolledByUserId: UUIDType,
  tenantId: UUIDType,
) {
  const courseIds = courseList.slice(0, 4).map((course) => course.id);

  if (courseIds.length === 0 || studentIds.length === 0) return [];

  const deadlineGroupsData = [
    {
      name: "Frontend Academy",
      characteristic: "Students assigned to frontend-oriented courses with deadlines.",
      studentIds,
      courseIds: courseIds.slice(0, 2),
      dueDateOffsetDays: 14,
    },
    {
      name: "Data Team",
      characteristic: "Students assigned to data-oriented courses with deadlines.",
      studentIds,
      courseIds: courseIds.slice(2),
      dueDateOffsetDays: 30,
    },
  ].filter((groupData) => groupData.courseIds.length > 0);

  const createdGroups = await db
    .insert(groups)
    .values(
      deadlineGroupsData.map((groupData) => ({
        name: sql`json_build_object('en', ${groupData.name}::text)`,
        characteristic: sql`json_build_object('en', ${groupData.characteristic}::text)`,
        tenantId,
      })),
    )
    .returning();

  await db.insert(groupUsers).values(
    createdGroups.flatMap((group, index) =>
      deadlineGroupsData[index].studentIds.map((studentId) => ({
        userId: studentId,
        groupId: group.id,
        tenantId,
      })),
    ),
  );

  const groupCourseValues = createdGroups.flatMap((group, index) => {
    const groupData = deadlineGroupsData[index];
    const dueDate = addDays(new Date(), groupData.dueDateOffsetDays);

    return groupData.courseIds.map((courseId) => ({
      groupId: group.id,
      courseId,
      enrolledBy: enrolledByUserId,
      isMandatory: true,
      dueDate,
      tenantId,
    }));
  });

  await db.insert(groupCourses).values(groupCourseValues);

  await db
    .insert(studentCourses)
    .values(
      groupCourseValues.flatMap((groupCourse) =>
        studentIds.map((studentId) => ({
          studentId,
          courseId: groupCourse.courseId,
          enrolledByGroupId: groupCourse.groupId,
          status: COURSE_ENROLLMENT.ENROLLED,
          archived: false,
          tenantId,
        })),
      ),
    )
    .onConflictDoUpdate({
      target: [studentCourses.studentId, studentCourses.courseId],
      set: {
        enrolledByGroupId: sql`EXCLUDED.enrolled_by_group_id`,
        status: sql`EXCLUDED.status`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    });

  return createdGroups;
}

async function createLessonProgress(userId: UUIDType, tenantId: UUIDType) {
  const courseLessonsList = await db
    .select({
      lessonId: sql<UUIDType>`${lessons.id}`,
      chapterId: sql<UUIDType>`${chapters.id}`,
      courseId: sql<UUIDType>`${courses.id}`,
      createdAt: sql<string>`${courses.createdAt}`,
      lessonType: sql<string>`${lessons.type}`,
      courseProgress: sql<string>`${studentCourses.progress}`,
    })
    .from(studentCourses)
    .innerJoin(courses, eq(studentCourses.courseId, courses.id))
    .innerJoin(chapters, eq(courses.id, chapters.courseId))
    .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
    .where(eq(studentCourses.studentId, userId));

  const lessonProgressList = courseLessonsList.map((courseLesson) => {
    const isCompleted =
      courseLesson.courseProgress === PROGRESS_STATUSES.COMPLETED ||
      (courseLesson.courseProgress === PROGRESS_STATUSES.IN_PROGRESS &&
        faker.datatype.boolean({ probability: 0.45 }));
    const isStarted =
      isCompleted ||
      (courseLesson.courseProgress === PROGRESS_STATUSES.IN_PROGRESS &&
        faker.datatype.boolean({ probability: 0.75 }));
    const completedAt = isCompleted
      ? faker.date.between({ from: courseLesson.createdAt, to: new Date() }).toISOString()
      : null;

    return {
      studentId: userId,
      lessonId: courseLesson.lessonId,
      chapterId: courseLesson.chapterId,
      createdAt: courseLesson.createdAt,
      updatedAt: courseLesson.createdAt,
      completedAt,
      isStarted,
      quizScore: courseLesson.lessonType === LESSON_TYPES.QUIZ ? 0 : null,
      attempts: courseLesson.lessonType === LESSON_TYPES.QUIZ ? 1 : null,
      isQuizPassed: courseLesson.lessonType === LESSON_TYPES.QUIZ ? isCompleted : null,
      tenantId,
    };
  });

  if (lessonProgressList.length === 0) return [];

  const createdLessonProgress = await db
    .insert(studentLessonProgress)
    .values(lessonProgressList)
    .returning();

  await createStudentChapterProgress(userId, tenantId);

  return createdLessonProgress;
}

async function createStudentChapterProgress(userId: UUIDType, tenantId: UUIDType) {
  const chapterProgressList = await db
    .select({
      chapterId: chapters.id,
      courseId: chapters.courseId,
      lessonCount: chapters.lessonCount,
      completedLessonCount: sql<number>`COUNT(${studentLessonProgress.completedAt})::INTEGER`,
      firstProgressAt: sql<string>`MIN(${studentLessonProgress.createdAt})`,
      completedAt: sql<string | null>`
        CASE
          WHEN COUNT(${studentLessonProgress.completedAt}) = ${chapters.lessonCount}
          THEN MAX(${studentLessonProgress.completedAt})
          ELSE NULL
        END
      `,
    })
    .from(studentLessonProgress)
    .innerJoin(chapters, eq(chapters.id, studentLessonProgress.chapterId))
    .where(and(eq(studentLessonProgress.studentId, userId), eq(chapters.tenantId, tenantId)))
    .groupBy(chapters.id, chapters.courseId, chapters.lessonCount);

  if (chapterProgressList.length === 0) return [];

  return db
    .insert(studentChapterProgress)
    .values(
      chapterProgressList.map((chapterProgress) => ({
        studentId: userId,
        courseId: chapterProgress.courseId,
        chapterId: chapterProgress.chapterId,
        completedLessonCount: chapterProgress.completedLessonCount,
        completedAt: chapterProgress.completedAt,
        createdAt: chapterProgress.firstProgressAt,
        updatedAt: chapterProgress.firstProgressAt,
        tenantId,
      })),
    )
    .onConflictDoUpdate({
      target: [
        studentChapterProgress.studentId,
        studentChapterProgress.courseId,
        studentChapterProgress.chapterId,
      ],
      set: {
        completedLessonCount: sql`excluded.completed_lesson_count`,
        completedAt: sql`excluded.completed_at`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

const getLessonLearningTimeSeconds = (lessonType: string, isCompleted: boolean) => {
  if (lessonType === LESSON_TYPES.QUIZ) {
    return faker.number.int({ min: isCompleted ? 240 : 90, max: isCompleted ? 720 : 360 });
  }

  if (lessonType === LESSON_TYPES.AI_MENTOR) {
    return faker.number.int({ min: isCompleted ? 480 : 180, max: isCompleted ? 1500 : 780 });
  }

  return faker.number.int({ min: isCompleted ? 360 : 120, max: isCompleted ? 1800 : 900 });
};

async function createLearningTimeForStudent(userId: UUIDType, tenantId: UUIDType) {
  const startedLessons = await db
    .select({
      lessonId: lessons.id,
      courseId: chapters.courseId,
      lessonType: lessons.type,
      isCompleted: sql<boolean>`${studentLessonProgress.completedAt} IS NOT NULL`,
      createdAt: studentLessonProgress.createdAt,
    })
    .from(studentLessonProgress)
    .innerJoin(lessons, eq(lessons.id, studentLessonProgress.lessonId))
    .innerJoin(chapters, eq(chapters.id, studentLessonProgress.chapterId))
    .where(
      and(
        eq(studentLessonProgress.studentId, userId),
        eq(studentLessonProgress.isStarted, true),
        eq(studentLessonProgress.tenantId, tenantId),
      ),
    );

  const learningTimeList = startedLessons.map((lessonProgress) => ({
    userId,
    lessonId: lessonProgress.lessonId,
    courseId: lessonProgress.courseId,
    totalSeconds: getLessonLearningTimeSeconds(
      lessonProgress.lessonType,
      lessonProgress.isCompleted,
    ),
    createdAt: lessonProgress.createdAt,
    updatedAt: lessonProgress.createdAt,
    tenantId,
  }));

  if (learningTimeList.length === 0) return [];

  return db
    .insert(lessonLearningTime)
    .values(learningTimeList)
    .onConflictDoUpdate({
      target: [lessonLearningTime.userId, lessonLearningTime.lessonId],
      set: {
        totalSeconds: sql`excluded.total_seconds`,
        updatedAt: sql`excluded.updated_at`,
      },
    });
}

async function createCoursesSummaryStats(courses: any[] = [], tenantId: UUIDType) {
  const createdCoursesSummaryStats = courses.map((course) => ({
    authorId: course.authorId,
    courseId: course.id,
    freePurchasedCount: faker.number.int({ min: 20, max: 40 }),
    paidPurchasedCount: faker.number.int({ min: 20, max: 40 }),
    paidPurchasedAfterFreemiumCount: faker.number.int({ min: 0, max: 20 }),
    completedFreemiumStudentCount: faker.number.int({ min: 40, max: 60 }),
    completedCourseStudentCount: faker.number.int({ min: 0, max: 20 }),
    tenantId,
  }));

  return db.insert(coursesSummaryStats).values(createdCoursesSummaryStats);
}

async function createQuizAttempts(userId: UUIDType, tenantId: UUIDType) {
  const quizzes = await db
    .select({ courseId: courses.id, lessonId: lessons.id, questionCount: count(questions.id) })
    .from(courses)
    .innerJoin(chapters, eq(courses.id, chapters.courseId))
    .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
    .innerJoin(questions, eq(questions.lessonId, lessons.id))
    .where(
      and(
        eq(courses.status, "published"),
        eq(lessons.type, LESSON_TYPES.QUIZ),
        eq(courses.tenantId, tenantId),
      ),
    )
    .groupBy(courses.id, lessons.id);

  const createdQuizAttempts = quizzes.map((quiz) => {
    const correctAnswers = faker.number.int({ min: 0, max: quiz.questionCount });

    return {
      userId,
      courseId: quiz.courseId,
      lessonId: quiz.lessonId,
      correctAnswers: correctAnswers,
      wrongAnswers: quiz.questionCount - correctAnswers,
      score: Math.round((correctAnswers / quiz.questionCount) * 100),
      tenantId,
    };
  });

  return db.insert(quizAttempts).values(createdQuizAttempts);
}

function getLast12Months(): Array<{ month: number; year: number; formattedDate: string }> {
  const today = new Date();
  return Array.from({ length: 12 }, (_, index) => {
    const date = subMonths(today, index);
    return {
      month: date.getMonth(),
      year: date.getFullYear(),
      formattedDate: format(date, "MMMM yyyy"),
    };
  }).reverse();
}

async function createCourseStudentsStats(tenantId: UUIDType) {
  const createdCourses = await db
    .select({
      courseId: courses.id,
      authorId: courses.authorId,
    })
    .from(courses)
    .where(and(eq(courses.status, "published"), eq(courses.tenantId, tenantId)));

  const twelveMonthsAgoArray = getLast12Months();

  const createdTwelveMonthsAgoStats = flatMap(createdCourses, (course) =>
    twelveMonthsAgoArray.map((monthDetails) => ({
      courseId: course.courseId,
      authorId: course.authorId,
      newStudentsCount: faker.number.int({ min: 5, max: 25 }),
      month: monthDetails.month,
      year: monthDetails.year,
      tenantId,
    })),
  );

  await db
    .insert(courseStudentsStats)
    .values(createdTwelveMonthsAgoStats)
    .onConflictDoNothing({
      target: [courseStudentsStats.courseId, courseStudentsStats.month, courseStudentsStats.year],
    });
}

async function seed() {
  await seedUserRoleGrantSql(db);

  await seedTruncateAllTables(db);

  const corsOrigin = process.env.CORS_ORIGIN;
  const devTenantOrigins = (process.env.DEV_TENANT_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin): origin is string => Boolean(origin));

  const tenantOrigins =
    devTenantOrigins.length > 0
      ? devTenantOrigins
      : [corsOrigin].filter((origin): origin is string => Boolean(origin));

  if (tenantOrigins.length === 0) {
    throw new Error("CORS_ORIGIN or DEV_TENANT_ORIGINS must be set to seed tenants.");
  }

  const primaryTenantOrigin = corsOrigin || tenantOrigins[0];

  try {
    for (const origin of tenantOrigins) {
      const name = new URL(origin).hostname;
      const emailSuffix = getTenantEmailSuffix(origin);
      const { id: tenantId } = await ensureSeedTenant(db, {
        name,
        host: origin,
        isManaging: origin === primaryTenantOrigin,
      });
      await seedSystemRolesForTenant(db, tenantId);

      await insertGlobalSettings(db, tenantId);
      console.log(`✨ Created global settings for tenant ${origin}`);

      const createdStudents = await createUsers(students, tenantId, "password", emailSuffix);
      const [createdAdmin] = await createUsers(admin, tenantId, "password", emailSuffix);
      const createdContentCreators = await createUsers(
        contentCreators,
        tenantId,
        "password",
        emailSuffix,
      );
      const createdTrainers = await createUsers(trainers, tenantId, "password", emailSuffix);
      await createUsers(
        [
          {
            email: "student0@example.com",
            firstName: faker.person.firstName(),
            lastName: "Student",
            roleSlug: SYSTEM_ROLE_SLUGS.STUDENT,
          },
        ],
        tenantId,
        "password",
        emailSuffix,
      );

      const createdStudentIds = createdStudents.map((student) => student.id);
      const creatorCourseIds = [
        createdAdmin.id,
        ...createdContentCreators.map((contentCreator) => contentCreator.id),
      ];

      console.log("Created or found admin user:", createdAdmin);
      console.log("Created or found students user:", createdStudents);
      console.log("Created or found content creators user:", createdContentCreators);
      console.log("Created or found trainers user:", createdTrainers);

      const createdCourses = await createNiceCourses(creatorCourseIds, db, niceCourses, tenantId);
      console.log("✨✨✨Created nice courses✨✨✨");
      await createNiceCourses([createdAdmin.id], db, e2eCourses, tenantId);
      console.log("🧪 Created e2e courses");
      await refreshSeedSearchDocuments(db, tenantId);

      console.log("Selected random courses for student from createdCourses");
      await createStudentCourses(createdCourses, createdStudentIds, tenantId);
      console.log("Created student courses");

      await createDeadlineGroups(createdCourses, createdStudentIds, createdAdmin.id, tenantId);
      console.log("Created deadline groups and group course enrollments");

      await Promise.all(
        createdStudentIds.map(async (studentId) => {
          await createLessonProgress(studentId, tenantId);
          await createLearningTimeForStudent(studentId, tenantId);
        }),
      );
      console.log("Created student lesson progress and learning time");

      await createCoursesSummaryStats(createdCourses, tenantId);

      await Promise.all(
        createdStudentIds.map(async (studentId) => {
          await createQuizAttempts(studentId, tenantId);
        }),
      );
      await createCourseStudentsStats(tenantId);
      console.log("Created student course students stats");
      console.log(`Seeding completed successfully for tenant ${origin}`);
    }
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    console.log("Closing database connection");
    try {
      await sqlConnect.end();
      console.log("Database connection closed successfully.");
    } catch (error) {
      console.error("Error closing the database connection:", error);
    }
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default seed;
