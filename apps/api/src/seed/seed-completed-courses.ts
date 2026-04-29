import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { subDays } from "date-fns";
import * as dotenv from "dotenv";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import hashPassword from "../common/helpers/hashPassword";
import { courses, credentials, studentCourses, tenants, users } from "../storage/schema";

import { assignSystemRoleToUser } from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

const COMPLETER_PASSWORD = "password";
const COMPLETER_EMAIL_PREFIX = "completer";
const COMPLETER_COUNT = 10;

const PRAVATAR_IDS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

type CompleterDistribution = {
  course: { id: UUIDType; title: unknown };
  studentCount: number;
};

function formatTitle(title: unknown): string {
  if (typeof title === "string") return title;
  if (title && typeof title === "object") {
    const localized = title as Record<string, string>;
    return localized.en ?? Object.values(localized)[0] ?? "(untitled)";
  }
  return "(untitled)";
}

async function pickTenant() {
  const [tenant] = await db.select().from(tenants).orderBy(asc(tenants.createdAt)).limit(1);
  if (!tenant) {
    throw new Error("No tenant found. Run pnpm db:seed first.");
  }
  return tenant;
}

async function pickPublishedCourses(tenantId: UUIDType, count: number) {
  const rows = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(and(eq(courses.tenantId, tenantId), eq(courses.status, "published")))
    .orderBy(asc(courses.createdAt))
    .limit(count);

  if (rows.length < count) {
    throw new Error(
      `Need at least ${count} published courses for tenant ${tenantId}, found ${rows.length}.`,
    );
  }

  return rows;
}

async function ensureCompleter(index: number, tenantId: UUIDType) {
  const email = `${COMPLETER_EMAIL_PREFIX}${index}@seed.local`;

  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email), eq(users.tenantId, tenantId)));

  const avatarReference = `https://i.pravatar.cc/150?img=${PRAVATAR_IDS[index % PRAVATAR_IDS.length]}`;

  if (existing) {
    if (existing.avatarReference !== avatarReference) {
      await db.update(users).set({ avatarReference }).where(eq(users.id, existing.id));
    }
    return { ...existing, avatarReference };
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      firstName: faker.person.firstName(),
      lastName: `Completer${index}`,
      avatarReference,
      tenantId,
    })
    .returning();

  await db.insert(credentials).values({
    userId: created.id,
    password: await hashPassword(COMPLETER_PASSWORD),
    tenantId,
  });

  await assignSystemRoleToUser(db, created.id, tenantId, SYSTEM_ROLE_SLUGS.STUDENT);

  return created;
}

async function ensureCompleters(tenantId: UUIDType) {
  const completers = [] as Awaited<ReturnType<typeof ensureCompleter>>[];
  for (let i = 0; i < COMPLETER_COUNT; i++) {
    completers.push(await ensureCompleter(i, tenantId));
  }
  return completers;
}

async function upsertCompletedEnrollment(
  studentId: UUIDType,
  courseId: UUIDType,
  tenantId: UUIDType,
  completedAt: string,
) {
  const enrolledAt = subDays(new Date(completedAt), 30).toISOString();

  await db
    .insert(studentCourses)
    .values({
      studentId,
      courseId,
      tenantId,
      progress: "completed",
      finishedChapterCount: 0,
      enrolledAt,
      completedAt,
      status: "enrolled",
    })
    .onConflictDoUpdate({
      target: [studentCourses.studentId, studentCourses.courseId],
      set: {
        progress: "completed",
        completedAt,
      },
    });
}

async function clearExistingCompletersForCourses(
  studentIds: UUIDType[],
  courseIds: UUIDType[],
  tenantId: UUIDType,
) {
  if (!studentIds.length || !courseIds.length) return;
  await db
    .delete(studentCourses)
    .where(
      and(
        eq(studentCourses.tenantId, tenantId),
        inArray(studentCourses.studentId, studentIds),
        inArray(studentCourses.courseId, courseIds),
      ),
    );
}

async function clearPriorCompletionsForCourses(courseIds: UUIDType[], tenantId: UUIDType) {
  if (!courseIds.length) return;
  await db
    .update(studentCourses)
    .set({ completedAt: null })
    .where(
      and(
        eq(studentCourses.tenantId, tenantId),
        inArray(studentCourses.courseId, courseIds),
        isNotNull(studentCourses.completedAt),
      ),
    );
}

async function seedCompletedCourses() {
  const tenant = await pickTenant();
  console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

  const publishedCourses = await pickPublishedCourses(tenant.id, 3);
  const [courseTen, courseOne, courseTwo] = publishedCourses;

  const completers = await ensureCompleters(tenant.id);
  console.log(`Ensured ${completers.length} completer users with pravatar avatars`);

  const courseIds = [courseTen.id, courseOne.id, courseTwo.id];

  await clearExistingCompletersForCourses(
    completers.map((completer) => completer.id),
    courseIds,
    tenant.id,
  );

  await clearPriorCompletionsForCourses(courseIds, tenant.id);

  const distributions: CompleterDistribution[] = [
    { course: courseTen, studentCount: 10 },
    { course: courseOne, studentCount: 1 },
    { course: courseTwo, studentCount: 2 },
  ];

  for (const { course, studentCount } of distributions) {
    const selected = completers.slice(0, studentCount);
    for (let i = 0; i < selected.length; i++) {
      const student = selected[i];
      const completedAt = subDays(new Date(), i).toISOString();
      await upsertCompletedEnrollment(student.id, course.id, tenant.id, completedAt);
    }
    console.log(`✓ ${formatTitle(course.title)}: ${studentCount} completer(s)`);
  }

  console.log("Done seeding course completers");
}

if (require.main === module) {
  seedCompletedCourses()
    .then(async () => {
      await sqlConnect.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Seeding completers failed:", error);
      try {
        await sqlConnect.end();
      } catch {
        // noop
      }
      process.exit(1);
    });
}

export default seedCompletedCourses;
