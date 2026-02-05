import { faker } from "@faker-js/faker";
import { format, subMonths } from "date-fns";
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

import hashPassword from "../common/helpers/hashPassword";
import {
  chapters,
  courses,
  coursesSummaryStats,
  courseStudentsStats,
  credentials,
  lessons,
  questions,
  quizAttempts,
  settings,
  studentCourses,
  studentLessonProgress,
  userDetails,
  userOnboarding,
  users,
} from "../storage/schema";
import { USER_ROLES } from "../user/schemas/userRoles";

import { e2eCourses } from "./e2e-data-seeds";
import { niceCourses } from "./nice-data-seeds";
import { createNiceCourses, ensureSeedTenant, seedTruncateAllTables } from "./seed-helpers";
import { admin, contentCreators, students } from "./users-seed";

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

function addEmailSuffix(email: string, suffix: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local}+${suffix}@${domain}`;
}

function getTenantEmailSuffix(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname.split(".")[0] || hostname;
}

async function createUsers(
  users: UsersSeed,
  tenantId: UUIDType,
  password = faker.internet.password(),
  emailSuffix?: string,
) {
  return Promise.all(
    users.map(async (userData) => {
      const baseEmail = userData.email || faker.internet.email();
      const email = emailSuffix ? addEmailSuffix(baseEmail, emailSuffix) : baseEmail;
      const userToCreate = {
        id: faker.string.uuid(),
        email,
        firstName: userData.firstName || faker.person.firstName(),
        lastName: userData.lastName || faker.person.lastName(),
        role: userData.role || USER_ROLES.STUDENT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tenantId,
      };

      const user = await createOrFindUser(userToCreate.email, password, userToCreate, tenantId);

      await insertUserSettings(db, user.id, tenantId, user.role === USER_ROLES.ADMIN);

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

  if (newUser.role === USER_ROLES.ADMIN || newUser.role === USER_ROLES.CONTENT_CREATOR)
    await insertUserDetails(newUser.id, tenantId);

  return newUser;
}

async function insertCredential(userId: UUIDType, tenantId: UUIDType, password: string) {
  const credentialData = {
    id: faker.string.uuid(),
    userId,
    password: await hashPassword(password),
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

  const companyInformation = createdGlobalSettings.settings?.companyInformation;

  if (!companyInformation) {
    const [updated] = await database
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

    return updated;
  }
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
  const studentsCoursesList = studentIds.flatMap((studentId) => {
    const courseCount = Math.floor(courses.length * 0.5);
    const selectedCourses = sampleSize(courses, courseCount);

    return selectedCourses.map((course) => {
      return {
        id: faker.string.uuid(),
        studentId: studentId,
        courseId: course.id,
        numberOfAssignments: faker.number.int({ min: 0, max: 10 }),
        numberOfFinishedAssignments: faker.number.int({ min: 0, max: 10 }),
        state: "not_started",
        archived: false,
        enrolledByGroupId: null,
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
      createdAt: sql<string>`${courses.createdAt}`,
      lessonType: sql<string>`${lessons.type}`,
    })
    .from(studentCourses)
    .leftJoin(courses, eq(studentCourses.courseId, courses.id))
    .leftJoin(chapters, eq(courses.id, chapters.courseId))
    .leftJoin(lessons, eq(lessons.chapterId, chapters.id))
    .where(eq(studentCourses.studentId, userId));

  const lessonProgressList = courseLessonsList.map((courseLesson) => {
    return {
      studentId: userId,
      lessonId: courseLesson.lessonId,
      chapterId: courseLesson.chapterId,
      createdAt: courseLesson.createdAt,
      updatedAt: courseLesson.createdAt,
      quizScore: courseLesson.lessonType === LESSON_TYPES.QUIZ ? 0 : null,
      attempts: courseLesson.lessonType === LESSON_TYPES.QUIZ ? 1 : null,
      isQuizPassed: courseLesson.lessonType === LESSON_TYPES.QUIZ ? false : null,
      tenantId,
    };
  });

  return db.insert(studentLessonProgress).values(lessonProgressList).returning();
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
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lms_app_user') THEN
        CREATE ROLE lms_app_user
          LOGIN
          PASSWORD 'replace_with_strong_password'
          NOSUPERUSER
          NOCREATEDB
          NOCREATEROLE
          NOBYPASSRLS;
      END IF;
    END
    $$;
  `);

  await db.execute(sql`GRANT CONNECT ON DATABASE guidebook TO lms_app_user;`);
  await db.execute(sql`GRANT USAGE ON SCHEMA public TO lms_app_user;`);
  await db.execute(
    sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lms_app_user;`,
  );
  await db.execute(sql`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lms_app_user;
  `);

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
      await createUsers(
        [
          {
            email: "student0@example.com",
            firstName: faker.person.firstName(),
            lastName: "Student",
            role: USER_ROLES.STUDENT,
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

      const createdCourses = await createNiceCourses(creatorCourseIds, db, niceCourses, tenantId);
      console.log("✨✨✨Created nice courses✨✨✨");
      await createNiceCourses([createdAdmin.id], db, e2eCourses, tenantId);
      console.log("🧪 Created e2e courses");

      console.log("Selected random courses for student from createdCourses");
      await createStudentCourses(createdCourses, createdStudentIds, tenantId);
      console.log("Created student courses");

      await Promise.all(
        createdStudentIds.map(async (studentId) => {
          await createLessonProgress(studentId, tenantId);
        }),
      );
      console.log("Created student lesson progress");

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
