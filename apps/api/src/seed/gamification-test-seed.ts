import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import * as dotenv from "dotenv";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { LESSON_TYPES } from "src/lesson/lesson.type";

import { createNiceCourses } from "./seed-helpers";
import {
  categories,
  courses,
  permissionRoles,
  permissionUserRoles,
  pointEvents,
  quizAttempts,
  studentChapterProgress,
  studentCourses,
  tenants,
  userAchievements,
  users,
  userStatistics,
} from "../storage/schema";

import type { NiceCourseData } from "../utils/types/test-types";
import type { DatabasePg } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

const GAMIFICATION_TEST_CATEGORY = "Gamification QA";

const buildSimpleCourse = (
  title: string,
  description: string,
  thumbnailSeed: string,
  chapterTitles: [string, string],
): NiceCourseData => ({
  title,
  description,
  status: "published",
  priceInCents: 0,
  category: GAMIFICATION_TEST_CATEGORY,
  language: "en",
  thumbnailS3Key: `https://picsum.photos/seed/${thumbnailSeed}/640/360`,
  hasCertificate: true,
  chapters: chapterTitles.map((chapterTitle) => ({
    title: chapterTitle,
    isFreemium: false,
    lessons: [
      {
        type: LESSON_TYPES.CONTENT,
        title: `${chapterTitle} — Lesson`,
        description: `Read this short lesson to complete ${chapterTitle}. No quizzes — completion awards chapter points.`,
      },
    ],
  })),
});

const gamificationTestCourses: NiceCourseData[] = [
  buildSimpleCourse(
    "QA Course 1 — Two Chapters",
    "Minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-1",
    ["Chapter 1 — Intro", "Chapter 2 — Wrap Up"],
  ),
  buildSimpleCourse(
    "QA Course 2 — Two Chapters",
    "Second minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-2",
    ["Chapter 1 — Start", "Chapter 2 — Finish"],
  ),
  buildSimpleCourse(
    "QA Course 3 — Two Chapters",
    "Third minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-3",
    ["Chapter 1 — Begin", "Chapter 2 — Conclude"],
  ),
  buildSimpleCourse(
    "QA Course 4 — Two Chapters",
    "Fourth minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-4",
    ["Chapter 1 — Open", "Chapter 2 — Close"],
  ),
  buildSimpleCourse(
    "QA Course 5 — Two Chapters",
    "Fifth minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-5",
    ["Chapter 1 — Kick Off", "Chapter 2 — Wind Down"],
  ),
  buildSimpleCourse(
    "QA Course 6 — Two Chapters",
    "Sixth minimal gamification QA course with two chapters and no quizzes.",
    "qa-course-6",
    ["Chapter 1 — Launch", "Chapter 2 — Land"],
  ),
];

async function resolveTenantId(): Promise<string> {
  const corsOrigin = process.env.CORS_ORIGIN;
  if (corsOrigin) {
    const host = new URL(corsOrigin).hostname;
    const [tenantByHost] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.host, corsOrigin))
      .limit(1);
    if (tenantByHost) return tenantByHost.id;

    const [tenantByName] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.name, host))
      .limit(1);
    if (tenantByName) return tenantByName.id;
  }

  const [firstTenant] = await db.select().from(tenants).limit(1);
  if (!firstTenant) {
    throw new Error("No tenant found. Run the main seed first (pnpm db:seed).");
  }
  return firstTenant.id;
}

async function resolveAuthorUserId(tenantId: string): Promise<string> {
  const [adminRole] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(
      and(eq(permissionRoles.tenantId, tenantId), eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.ADMIN)),
    )
    .limit(1);

  if (adminRole) {
    const [adminUser] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(permissionUserRoles.roleId, adminRole.id),
        ),
      )
      .limit(1);
    if (adminUser) return adminUser.id;
  }

  const [creatorRole] = await db
    .select({ id: permissionRoles.id })
    .from(permissionRoles)
    .where(
      and(
        eq(permissionRoles.tenantId, tenantId),
        eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.CONTENT_CREATOR),
      ),
    )
    .limit(1);

  if (creatorRole) {
    const [creatorUser] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
      .where(
        and(
          eq(users.tenantId, tenantId),
          eq(permissionUserRoles.roleId, creatorRole.id),
        ),
      )
      .limit(1);
    if (creatorUser) return creatorUser.id;
  }

  throw new Error(
    `No admin or content creator user found for tenant ${tenantId}. Run the main seed first.`,
  );
}

async function deleteGamificationTestCourses(tenantId: string) {
  const qaCategories = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.tenantId, tenantId),
        eq(categories.title, GAMIFICATION_TEST_CATEGORY),
      ),
    );

  if (qaCategories.length === 0) {
    console.log("No existing Gamification QA category, skipping course delete.");
    return;
  }

  const categoryIds = qaCategories.map((c) => c.id);

  const existing = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(eq(courses.tenantId, tenantId), inArray(courses.categoryId, categoryIds)),
    );

  if (existing.length === 0) {
    console.log("No existing Gamification QA courses to delete.");
    return;
  }

  const courseIds = existing.map((c) => c.id);

  await db.delete(studentChapterProgress).where(inArray(studentChapterProgress.courseId, courseIds));
  await db.delete(studentCourses).where(inArray(studentCourses.courseId, courseIds));
  await db.delete(quizAttempts).where(inArray(quizAttempts.courseId, courseIds));

  await db.delete(courses).where(inArray(courses.id, courseIds));
  console.log(`Deleted ${courseIds.length} Gamification QA course(s).`);
}

async function resetWilmerPoints(tenantId: string) {
  const wilmers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(eq(users.tenantId, tenantId), eq(users.firstName, "Wilmer")),
    );

  if (wilmers.length === 0) {
    console.log("No Wilmer user found, skipping points reset.");
    return;
  }

  for (const wilmer of wilmers) {
    await db.delete(pointEvents).where(eq(pointEvents.userId, wilmer.id));
    await db.delete(userAchievements).where(eq(userAchievements.userId, wilmer.id));
    await db
      .update(userStatistics)
      .set({
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        lastPointAt: null,
        lastActivityDate: null,
        activityHistory: {},
        updatedAt: sql`now()`,
      })
      .where(eq(userStatistics.userId, wilmer.id));
    console.log(`Reset gamification points for ${wilmer.email}.`);
  }
}

async function seed() {
  try {
    const tenantId = await resolveTenantId();
    console.log(`Using tenant ${tenantId}`);

    const authorId = await resolveAuthorUserId(tenantId);
    console.log(`Using author user ${authorId}`);

    await deleteGamificationTestCourses(tenantId);
    await resetWilmerPoints(tenantId);

    const createdCourses = await createNiceCourses(
      [authorId],
      db,
      gamificationTestCourses,
      tenantId,
    );

    console.log(
      `Created ${createdCourses.length} gamification test course(s):`,
      createdCourses.map((course) => course.id),
    );
    console.log(
      "Login as a student, enroll in a course, and complete the chapters to verify points.",
    );
  } catch (error) {
    console.error("Gamification test seed failed:", error);
    process.exitCode = 1;
  } finally {
    try {
      await sqlConnect.end();
    } catch (error) {
      console.error("Error closing the database connection:", error);
    }
  }
}

if (require.main === module) {
  seed()
    .then(() => process.exit(process.exitCode ?? 0))
    .catch((error) => {
      console.error("An error occurred:", error);
      process.exit(1);
    });
}

export default seed;
