import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, SYSTEM_ROLE_SLUGS, type SystemRoleSlug } from "@repo/shared";
import * as dotenv from "dotenv";
import { and, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { sampleSize } from "lodash";
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
  credentials,
  lessonLearningTime,
  lessons,
  settings,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
  userDetails,
  userOnboarding,
  users,
} from "../storage/schema";

import { niceCourses } from "./nice-data-seeds";
import {
  addEmailSuffix,
  assignSystemRoleToUser,
  createNiceCourses,
  ensureSeedTenant,
  getTenantEmailSuffix,
  refreshSeedSearchDocuments,
  seedSystemRolesForTenant,
  seedUserRoleGrantSql,
} from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

function generateDeterministicEmail(
  roleSlug: SystemRoleSlug,
  index: number,
  suffix?: string,
): string {
  const roleKey = roleSlug === SYSTEM_ROLE_SLUGS.CONTENT_CREATOR ? "creator" : roleSlug;
  return addEmailSuffix(`user+${roleKey}+${index}@example.com`, suffix);
}

export async function generateBulkUsers(
  count: number,
  roleSlug: SystemRoleSlug,
  tenantId: UUIDType,
  password: string = "password",
  startIndex: number = 1,
  emailSuffix?: string,
) {
  const createdUsers = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const userToCreate = {
      id: faker.string.uuid(),
      email: generateDeterministicEmail(roleSlug, index, emailSuffix),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId,
    };

    const user = await createOrFindUser(
      userToCreate.email,
      password,
      userToCreate,
      tenantId,
      roleSlug,
    );
    await insertUserSettings(db, user.id, tenantId, roleSlug === SYSTEM_ROLE_SLUGS.ADMIN);
    await insertUserDetails(user.id, tenantId);

    createdUsers.push(user);
  }

  return createdUsers;
}

async function createOrFindUser(
  email: string,
  password: string,
  userData: any,
  tenantId: UUIDType,
  roleSlug: SystemRoleSlug,
) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) {
    await assignSystemRoleToUser(db, existingUser.id, existingUser.tenantId, roleSlug);
    return existingUser;
  }

  const [newUser] = await db.insert(users).values(userData).returning();

  await insertCredential(newUser.id, tenantId, password);
  await insertOnboardingData(newUser.id, tenantId);
  await assignSystemRoleToUser(db, newUser.id, tenantId, roleSlug);

  return newUser;
}

async function insertCredential(userId: UUIDType, tenantId: UUIDType, password: string) {
  const credentialData = {
    id: faker.string.uuid(),
    userId,
    password: await hashPassword(password),
    requiresPasswordChange: true,
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
  const [globalSettings] = await database
    .select()
    .from(settings)
    .where(and(isNull(settings.userId), eq(settings.tenantId, tenantId)));

  if (globalSettings) return globalSettings;

  const [createdGlobalSettings] = await database
    .insert(settings)
    .values({
      settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
      tenantId,
    })
    .returning();

  const [updatedGlobalSettings] = await database
    .update(settings)
    .set({
      settings: sql`
            jsonb_set(
              settings.settings,
              '{companyInformation}',
              to_jsonb(${settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS.companyInformation)}),
              true
            )
          `,
    })
    .where(eq(settings.id, createdGlobalSettings.id))
    .returning();

  return updatedGlobalSettings;
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
    const courseCount = Math.floor(courses.length * 0.3); // Enroll in 30% of courses
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

async function createCoursesSummaryStats(courses: any[], tenantId: UUIDType) {
  if (courses.length === 0) return [];

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

  return db.insert(coursesSummaryStats).values(createdCoursesSummaryStats).onConflictDoNothing();
}

export async function seedBulkUsers(options: {
  studentCount?: number;
  adminCount?: number;
  contentCreatorCount?: number;
  password?: string;
  createCourses?: boolean;
  enrollStudents?: boolean;
}) {
  await seedUserRoleGrantSql(db);

  const {
    studentCount = 1000,
    adminCount = 100,
    contentCreatorCount = 100,
    password = "password",
    createCourses = false,
    enrollStudents = false,
  } = options;

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
      const tenant = await ensureSeedTenant(db, {
        name,
        host: origin,
        isManaging: origin === primaryTenantOrigin,
      });

      const tenantId = tenant.id;
      await seedSystemRolesForTenant(db, tenantId);

      await insertGlobalSettings(db, tenantId);
      console.log(`✨ Created global settings for tenant ${origin}`);

      // Generate users with deterministic emails
      // Students: user+student+1@example.com to user+student+1000@example.com
      console.log(`Creating ${studentCount} students for ${origin}...`);
      const createdStudents = await generateBulkUsers(
        studentCount,
        SYSTEM_ROLE_SLUGS.STUDENT,
        tenantId,
        password,
        1, // Start index
        emailSuffix,
      );
      console.log(
        `✅ Created ${createdStudents.length} students (user+student+1@example.com to user+student+${studentCount}@example.com)`,
      );

      // Admins: user+admin+1@example.com to user+admin+100@example.com
      console.log(`Creating ${adminCount} admins for ${origin}...`);
      const createdAdmins = await generateBulkUsers(
        adminCount,
        SYSTEM_ROLE_SLUGS.ADMIN,
        tenantId,
        password,
        1, // Start index
        emailSuffix,
      );
      console.log(
        `✅ Created ${createdAdmins.length} admins (user+admin+1@example.com to user+admin+${adminCount}@example.com)`,
      );

      // Content Creators: user+creator+1@example.com to user+creator+100@example.com
      console.log(`Creating ${contentCreatorCount} content creators for ${origin}...`);
      const createdContentCreators = await generateBulkUsers(
        contentCreatorCount,
        SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
        tenantId,
        password,
        1, // Start index
        emailSuffix,
      );
      console.log(
        `✅ Created ${createdContentCreators.length} content creators (user+creator+1@example.com to user+creator+${contentCreatorCount}@example.com)`,
      );

      // Optionally create courses and enroll students
      if (createCourses && createdContentCreators.length > 0) {
        const creatorIds = createdContentCreators.map((cc) => cc.id);
        const createdCourses = await createNiceCourses(creatorIds, db, niceCourses, tenantId);
        console.log(`✨ Created ${createdCourses.length} courses`);
        await refreshSeedSearchDocuments(db, tenantId);
        await createCoursesSummaryStats(createdCourses, tenantId);
        console.log(`✅ Created course summary stats`);

        if (enrollStudents && createdStudents.length > 0) {
          const studentIds = createdStudents.map((s) => s.id);
          await createStudentCourses(createdCourses, studentIds, tenantId);
          console.log(`✅ Enrolled students in courses`);

          // Create lesson progress for enrolled students
          await Promise.all(
            studentIds.map(async (studentId) => {
              await createLessonProgress(studentId, tenantId);
              await createLearningTimeForStudent(studentId, tenantId);
            }),
          );
          console.log(`✅ Created lesson progress and learning time for students`);
        }
      }

      console.log("\n📊 Summary:");
      console.log(
        `  Students: ${createdStudents.length} (user+student+1@example.com to user+student+${studentCount}@example.com)`,
      );
      console.log(
        `  Admins: ${createdAdmins.length} (user+admin+1@example.com to user+admin+${adminCount}@example.com)`,
      );
      console.log(
        `  Content Creators: ${createdContentCreators.length} (user+creator+1@example.com to user+creator+${contentCreatorCount}@example.com)`,
      );
      console.log(`\n📝 All users use password: ${password}`);
      console.log(
        `\n💡 k6 tests can generate these emails deterministically using the same pattern`,
      );

      console.log(`\n✅ Bulk user seeding completed successfully for ${origin}!`);
    }
  } catch (error) {
    console.error("❌ Bulk user seeding failed:", error);
    throw error;
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

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  // Default to 1000 students, 100 admins, 100 creators for stress testing
  const studentCount = parseInt(args[0]) || 1000;
  const adminCount = parseInt(args[1]) || 100;
  const contentCreatorCount = parseInt(args[2]) || 100;
  const password = args[3] || "password";

  seedBulkUsers({
    studentCount,
    adminCount,
    contentCreatorCount,
    password,
    createCourses: false,
    enrollStudents: false,
  })
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default seedBulkUsers;
