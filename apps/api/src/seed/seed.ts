import { faker } from "@faker-js/faker";
import { format, subMonths } from "date-fns";
import * as dotenv from "dotenv";
import { and, count, eq, isNull, sql } from "drizzle-orm";
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
  users,
} from "../storage/schema";
import { USER_ROLES } from "../user/schemas/userRoles";

import { e2eCourses } from "./e2e-data-seeds";
import { niceCourses } from "./nice-data-seeds";
import { createNiceCourses, seedTruncateAllTables } from "./seed-helpers";
import { admin, contentCreators, students } from "./users-seed";

import type { UsersSeed } from "./seed.types";
import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env)) {
  throw new Error("DATABASE_URL not found on .env");
}

const connectionString = process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

async function createUsers(users: UsersSeed, password = faker.internet.password()) {
  return Promise.all(
    users.map(async (userData) => {
      const userToCreate = {
        id: faker.string.uuid(),
        email: userData.email || faker.internet.email(),
        firstName: userData.firstName || faker.person.firstName(),
        lastName: userData.lastName || faker.person.lastName(),
        role: userData.role || USER_ROLES.STUDENT,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const user = await createOrFindUser(userToCreate.email, password, userToCreate);

      await insertUserSettings(db, user.id, user.role === USER_ROLES.ADMIN);

      return user;
    }),
  );
}

async function createOrFindUser(email: string, password: string, userData: any) {
  const [existingUser] = await db.select().from(users).where(eq(users.email, email));
  if (existingUser) return existingUser;

  const [newUser] = await db.insert(users).values(userData).returning();

  await insertCredential(newUser.id, password);

  if (newUser.role === USER_ROLES.ADMIN || newUser.role === USER_ROLES.CONTENT_CREATOR)
    await insertUserDetails(newUser.id);

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

async function createCoursesSummaryStats(courses: any[] = []) {
  const createdCoursesSummaryStats = courses.map((course) => ({
    authorId: course.authorId,
    courseId: course.id,
    freePurchasedCount: faker.number.int({ min: 20, max: 40 }),
    paidPurchasedCount: faker.number.int({ min: 20, max: 40 }),
    paidPurchasedAfterFreemiumCount: faker.number.int({ min: 0, max: 20 }),
    completedFreemiumStudentCount: faker.number.int({ min: 40, max: 60 }),
    completedCourseStudentCount: faker.number.int({ min: 0, max: 20 }),
  }));

  return db.insert(coursesSummaryStats).values(createdCoursesSummaryStats);
}

async function createQuizAttempts(userId: UUIDType) {
  const quizzes = await db
    .select({ courseId: courses.id, lessonId: lessons.id, questionCount: count(questions.id) })
    .from(courses)
    .innerJoin(chapters, eq(courses.id, chapters.courseId))
    .innerJoin(lessons, eq(lessons.chapterId, chapters.id))
    .innerJoin(questions, eq(questions.lessonId, lessons.id))
    .where(and(eq(courses.status, "published"), eq(lessons.type, LESSON_TYPES.QUIZ)))
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

async function createCourseStudentsStats() {
  const createdCourses = await db
    .select({
      courseId: courses.id,
      authorId: courses.authorId,
    })
    .from(courses)
    .where(eq(courses.status, "published"));

  const twelveMonthsAgoArray = getLast12Months();

  const createdTwelveMonthsAgoStats = flatMap(createdCourses, (course) =>
    twelveMonthsAgoArray.map((monthDetails) => ({
      courseId: course.courseId,
      authorId: course.authorId,
      newStudentsCount: faker.number.int({ min: 5, max: 25 }),
      month: monthDetails.month,
      year: monthDetails.year,
    })),
  );

  await db.insert(courseStudentsStats).values(createdTwelveMonthsAgoStats);
}

async function seed() {
  await seedTruncateAllTables(db);

  try {
    await insertGlobalSettings(db);
    console.log("✨ Created global settings");

    const createdStudents = await createUsers(students, "password");
    const [createdAdmin] = await createUsers(admin, "password");
    const createdContentCreators = await createUsers(contentCreators, "password");
    await createUsers(
      [
        {
          email: "student0@example.com",
          firstName: faker.person.firstName(),
          lastName: "Student",
          role: USER_ROLES.STUDENT,
        },
      ],
      "password",
    );

    const createdStudentIds = createdStudents.map((student) => student.id);
    const creatorCourseIds = [
      createdAdmin.id,
      ...createdContentCreators.map((contentCreator) => contentCreator.id),
    ];

    console.log("Created or found admin user:", createdAdmin);
    console.log("Created or found students user:", createdStudents);
    console.log("Created or found content creators user:", createdContentCreators);

    const createdCourses = await createNiceCourses(creatorCourseIds, db, niceCourses);
    console.log("✨✨✨Created nice courses✨✨✨");
    await createNiceCourses([createdAdmin.id], db, e2eCourses);
    console.log("🧪 Created e2e courses");

    console.log("Selected random courses for student from createdCourses");
    await createStudentCourses(createdCourses, createdStudentIds);
    console.log("Created student courses");

    await Promise.all(
      createdStudentIds.map(async (studentId) => {
        await createLessonProgress(studentId);
      }),
    );
    console.log("Created student lesson progress");

    await createCoursesSummaryStats(createdCourses);

    await Promise.all(
      createdStudentIds.map(async (studentId) => {
        await createQuizAttempts(studentId);
      }),
    );
    await createCourseStudentsStats();
    console.log("Created student course students stats");
    console.log("Seeding completed successfully");
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
