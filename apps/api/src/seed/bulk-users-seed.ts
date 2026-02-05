import { faker } from "@faker-js/faker";
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
  credentials,
  lessons,
  settings,
  studentCourses,
  studentLessonProgress,
  userDetails,
  userOnboarding,
  users,
} from "../storage/schema";
import { USER_ROLES } from "../user/schemas/userRoles";

import { niceCourses } from "./nice-data-seeds";
import { createNiceCourses, ensureSeedTenant } from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";
import type { UserRole } from "../user/schemas/userRoles";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

function addEmailSuffix(email: string, suffix?: string) {
  if (!suffix) return email;
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local}+${suffix}@${domain}`;
}

function getTenantEmailSuffix(origin: string) {
  const hostname = new URL(origin).hostname;
  return hostname.split(".")[0] || hostname;
}

function generateDeterministicEmail(role: UserRole, index: number, suffix?: string): string {
  const roleKey = role === USER_ROLES.CONTENT_CREATOR ? "creator" : role.toLowerCase();
  return addEmailSuffix(`user+${roleKey}+${index}@example.com`, suffix);
}

export async function generateBulkUsers(
  count: number,
  role: UserRole,
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
      email: generateDeterministicEmail(role, index, emailSuffix),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tenantId,
    };

    const user = await createOrFindUser(userToCreate.email, password, userToCreate, tenantId);
    await insertUserSettings(db, user.id, tenantId, user.role === USER_ROLES.ADMIN);

    if (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.CONTENT_CREATOR) {
      await insertUserDetails(user.id, tenantId);
    }

    createdUsers.push(user);
  }

  return createdUsers;
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
  const [globalSettings] = await database
    .select()
    .from(settings)
    .where(and(isNull(settings.userId), eq(settings.tenantId, tenantId)));
  if (globalSettings) {
    const companyInformation = (globalSettings.settings as any)?.companyInformation;
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
        .where(eq(settings.id, globalSettings.id))
        .returning();
      return updated;
    }
    return globalSettings;
  }

  const [createdGlobalSettings] = await database
    .insert(settings)
    .values({
      settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
      tenantId,
    })
    .returning();

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
  const studentsCoursesList = studentIds.flatMap((studentId) => {
    const courseCount = Math.floor(courses.length * 0.3); // Enroll in 30% of courses
    const selectedCourses = sampleSize(courses, courseCount);

    return selectedCourses.map((course) => {
      return {
        id: faker.string.uuid(),
        studentId: studentId,
        courseId: course.id,
        numberOfAssignments: faker.number.int({ min: 0, max: 10 }),
        numberOfFinishedAssignments: faker.number.int({ min: 0, max: 10 }),
        state: PROGRESS_STATUSES.NOT_STARTED,
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

export async function seedBulkUsers(options: {
  studentCount?: number;
  adminCount?: number;
  contentCreatorCount?: number;
  password?: string;
  createCourses?: boolean;
  enrollStudents?: boolean;
}) {
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

      await insertGlobalSettings(db, tenantId);
      console.log(`✨ Created global settings for tenant ${origin}`);

      // Generate users with deterministic emails
      // Students: user+student+1@example.com to user+student+1000@example.com
      console.log(`Creating ${studentCount} students for ${origin}...`);
      const createdStudents = await generateBulkUsers(
        studentCount,
        USER_ROLES.STUDENT,
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
        USER_ROLES.ADMIN,
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
        USER_ROLES.CONTENT_CREATOR,
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

        if (enrollStudents && createdStudents.length > 0) {
          const studentIds = createdStudents.map((s) => s.id);
          await createStudentCourses(createdCourses, studentIds, tenantId);
          console.log(`✅ Enrolled students in courses`);

          // Create lesson progress for enrolled students
          await Promise.all(
            studentIds.map(async (studentId) => {
              await createLessonProgress(studentId, tenantId);
            }),
          );
          console.log(`✅ Created lesson progress for students`);
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
