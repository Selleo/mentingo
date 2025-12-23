import { faker } from "@faker-js/faker";
import * as dotenv from "dotenv";
import { eq, isNull, sql } from "drizzle-orm";
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
import { createNiceCourses } from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";
import type { UserRole } from "../user/schemas/userRoles";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env)) {
  throw new Error("DATABASE_URL not found on .env");
}

const connectionString = process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

function generateDeterministicEmail(role: UserRole, index: number): string {
  const roleKey = role === USER_ROLES.CONTENT_CREATOR ? "creator" : role.toLowerCase();
  return `user+${roleKey}+${index}@example.com`;
}

export async function generateBulkUsers(
  count: number,
  role: UserRole,
  password: string = "password",
  startIndex: number = 1,
) {
  const createdUsers = [];

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const userToCreate = {
      id: faker.string.uuid(),
      email: generateDeterministicEmail(role, index),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const user = await createOrFindUser(userToCreate.email, password, userToCreate);
    await insertUserSettings(db, user.id, user.role === USER_ROLES.ADMIN);

    if (user.role === USER_ROLES.ADMIN || user.role === USER_ROLES.CONTENT_CREATOR) {
      await insertUserDetails(user.id);
    }

    createdUsers.push(user);
  }

  return createdUsers;
}

async function createOrFindUser(email: string, password: string, userData: any) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) return existingUser;

  const [newUser] = await db.insert(users).values(userData).returning();

  await insertCredential(newUser.id, password);
  await insertOnboardingData(newUser.id);

  return newUser;
}

async function insertCredential(userId: UUIDType, password: string) {
  const credentialData = {
    id: faker.string.uuid(),
    userId,
    password: await hashPassword(password),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return (await db.insert(credentials).values(credentialData).returning())[0];
}

export async function insertOnboardingData(userId: UUIDType) {
  return await db.insert(userOnboarding).values({
    userId,
  });
}

async function insertUserDetails(userId: UUIDType) {
  return await db.insert(userDetails).values({
    userId,
    description: faker.lorem.paragraph(3),
    contactEmail: faker.internet.email(),
    contactPhoneNumber: faker.phone.number(),
    jobTitle: faker.person.jobTitle(),
  });
}

export async function insertGlobalSettings(database: DatabasePg) {
  const [globalSettings] = await database.select().from(settings).where(isNull(settings.userId));
  if (globalSettings) return globalSettings;

  const [createdGlobalSettings] = await database
    .insert(settings)
    .values({
      settings: settingsToJSONBuildObject(DEFAULT_GLOBAL_SETTINGS),
    })
    .returning();

  return createdGlobalSettings;
}

export async function insertUserSettings(database: DatabasePg, userId: UUIDType, isAdmin: boolean) {
  const [existingUserSettings] = await database
    .select()
    .from(settings)
    .where(eq(settings.userId, userId));

  if (existingUserSettings) return existingUserSettings;

  const settingsObject = isAdmin ? DEFAULT_ADMIN_SETTINGS : DEFAULT_STUDENT_SETTINGS;
  const [createdUserSettings] = await database
    .insert(settings)
    .values({
      userId,
      settings: settingsToJSONBuildObject(settingsObject),
    })
    .returning();

  return createdUserSettings;
}

async function createStudentCourses(courses: any[], studentIds: UUIDType[]) {
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
      };
    });
  });

  return db.insert(studentCourses).values(studentsCoursesList).returning();
}

async function createLessonProgress(userId: UUIDType) {
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
  const {
    studentCount = 1000,
    adminCount = 100,
    contentCreatorCount = 100,
    password = "password",
    createCourses = false,
    enrollStudents = false,
  } = options;

  try {
    await insertGlobalSettings(db);
    console.log("✨ Created global settings");

    // Generate users with deterministic emails
    // Students: user+student+1@example.com to user+student+1000@example.com
    console.log(`Creating ${studentCount} students...`);
    const createdStudents = await generateBulkUsers(
      studentCount,
      USER_ROLES.STUDENT,
      password,
      1, // Start index
    );
    console.log(
      `✅ Created ${createdStudents.length} students (user+student+1@example.com to user+student+${studentCount}@example.com)`,
    );

    // Admins: user+admin+1@example.com to user+admin+100@example.com
    console.log(`Creating ${adminCount} admins...`);
    const createdAdmins = await generateBulkUsers(
      adminCount,
      USER_ROLES.ADMIN,
      password,
      1, // Start index
    );
    console.log(
      `✅ Created ${createdAdmins.length} admins (user+admin+1@example.com to user+admin+${adminCount}@example.com)`,
    );

    // Content Creators: user+creator+1@example.com to user+creator+100@example.com
    console.log(`Creating ${contentCreatorCount} content creators...`);
    const createdContentCreators = await generateBulkUsers(
      contentCreatorCount,
      USER_ROLES.CONTENT_CREATOR,
      password,
      1, // Start index
    );
    console.log(
      `✅ Created ${createdContentCreators.length} content creators (user+creator+1@example.com to user+creator+${contentCreatorCount}@example.com)`,
    );

    // Optionally create courses and enroll students
    if (createCourses && createdContentCreators.length > 0) {
      const creatorIds = createdContentCreators.map((cc) => cc.id);
      const createdCourses = await createNiceCourses(creatorIds, db, niceCourses);
      console.log(`✨ Created ${createdCourses.length} courses`);

      if (enrollStudents && createdStudents.length > 0) {
        const studentIds = createdStudents.map((s) => s.id);
        await createStudentCourses(createdCourses, studentIds);
        console.log(`✅ Enrolled students in courses`);

        // Create lesson progress for enrolled students
        await Promise.all(
          studentIds.map(async (studentId) => {
            await createLessonProgress(studentId);
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
    console.log(`\n💡 k6 tests can generate these emails deterministically using the same pattern`);

    console.log("\n✅ Bulk user seeding completed successfully!");

    return {
      students: createdStudents,
      admins: createdAdmins,
      contentCreators: createdContentCreators,
    };
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
