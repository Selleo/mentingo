import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT, COURSE_STATUSES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { addDays } from "date-fns";
import * as dotenv from "dotenv";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import {
  courses,
  groupCourses,
  groups,
  groupUsers,
  permissionRoles,
  permissionUserRoles,
  settings,
  studentCourses,
  tenants,
  users,
} from "../storage/schema";
import { PROGRESS_STATUSES } from "../utils/types/progress.type";

import {
  DUE_DATES_SEED_COURSES,
  DUE_DATES_SEED_GROUP_NAME,
  DUE_DATES_SEED_LEARNER_COUNT,
} from "./course-due-dates-seed-data";
import { localizedText } from "./reports-seed.utils";
import {
  addEmailSuffix,
  assignSystemRoleToUser,
  getSeedTenantOrigins,
  getTenantEmailSuffix,
} from "./seed-helpers";

import type { DatabasePg, UUIDType } from "../common";

dotenv.config({ path: "./.env" });

if (!("DATABASE_URL" in process.env) && !("MIGRATOR_DATABASE_URL" in process.env)) {
  throw new Error("MIGRATOR_DATABASE_URL or DATABASE_URL not found on .env");
}

const connectionString = process.env.MIGRATOR_DATABASE_URL || process.env.DATABASE_URL!;
const sqlConnect = postgres(connectionString);
const db = drizzle(sqlConnect) as DatabasePg;

/**
 * Adds overdue and at-risk mandatory group courses on top of `pnpm db:seed`, so the admin
 * due-date emails and the report due-date filter have data. Admins get overdue notifications
 * enabled. Running it again keeps the demo learners and group but moves every due date back
 * to the same offsets from today, so both emails always have something to send.
 */
async function seedCourseDueDates() {
  try {
    for (const origin of getSeedTenantOrigins()) {
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

  const courseIds = await findPublishedCourseIds(tenant.id);
  if (courseIds.length < DUE_DATES_SEED_COURSES.length) {
    console.log(`⏭️  ${origin}: needs ${DUE_DATES_SEED_COURSES.length} published courses`);
    return;
  }

  const adminId = await enableOverdueNotificationsForAdmins(tenant.id);
  const learnerIds = await findOrCreateLearners(tenant.id, getTenantEmailSuffix(origin));
  const groupId = await findOrCreateGroupWithLearners(tenant.id, learnerIds);
  await clearPreviousDueDateAssignments(groupId, learnerIds);

  for (const [index, dueDateCourse] of DUE_DATES_SEED_COURSES.entries()) {
    await assignCourseWithDueDate({
      tenantId: tenant.id,
      groupId,
      courseId: courseIds[index],
      assignedBy: adminId,
      learnerIds: learnerIds.slice(0, dueDateCourse.enrolledLearners),
      ...dueDateCourse,
    });
  }

  console.log(
    `✅ ${origin}: ${learnerIds.length} learners in "${DUE_DATES_SEED_GROUP_NAME}" with ${DUE_DATES_SEED_COURSES.length} due-dated courses, dated from today`,
  );
}

async function findPublishedCourseIds(tenantId: UUIDType): Promise<UUIDType[]> {
  const publishedCourses = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.tenantId, tenantId),
        eq(courses.isArchived, false),
        ne(courses.status, COURSE_STATUSES.DRAFT),
      ),
    )
    .orderBy(asc(courses.createdAt))
    .limit(DUE_DATES_SEED_COURSES.length);

  return publishedCourses.map(({ id }) => id);
}

async function enableOverdueNotificationsForAdmins(tenantId: UUIDType): Promise<UUIDType | null> {
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .innerJoin(permissionUserRoles, eq(permissionUserRoles.userId, users.id))
    .innerJoin(permissionRoles, eq(permissionRoles.id, permissionUserRoles.roleId))
    .where(and(eq(users.tenantId, tenantId), eq(permissionRoles.slug, SYSTEM_ROLE_SLUGS.ADMIN)));

  if (!admins.length) return null;

  await db
    .update(settings)
    .set({
      settings: sql`${settings.settings} || jsonb_build_object('adminOverdueCourseNotification', true)`,
    })
    .where(
      inArray(
        settings.userId,
        admins.map(({ id }) => id),
      ),
    );

  return admins[0].id;
}

async function findOrCreateLearners(tenantId: UUIDType, emailSuffix: string) {
  const learnerIds: UUIDType[] = [];

  for (let index = 1; index <= DUE_DATES_SEED_LEARNER_COUNT; index++) {
    const email = addEmailSuffix(`user+due-dates+${index}@example.com`, emailSuffix);
    const [existingLearner] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)));

    if (existingLearner) {
      learnerIds.push(existingLearner.id);
      continue;
    }

    const [learner] = await db
      .insert(users)
      .values({
        email,
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

async function findOrCreateGroupWithLearners(tenantId: UUIDType, learnerIds: UUIDType[]) {
  const [existingGroup] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(eq(groups.tenantId, tenantId), sql`${groups.name}->>'en' = ${DUE_DATES_SEED_GROUP_NAME}`),
    );

  const groupId =
    existingGroup?.id ??
    (
      await db
        .insert(groups)
        .values({ name: localizedText(DUE_DATES_SEED_GROUP_NAME), tenantId })
        .returning({ id: groups.id })
    )[0].id;

  await db
    .insert(groupUsers)
    .values(learnerIds.map((userId) => ({ userId, groupId, tenantId })))
    .onConflictDoNothing();

  return groupId;
}

/** Only the demo group's course assignments and the demo learners' enrollments are removed. */
async function clearPreviousDueDateAssignments(groupId: UUIDType, learnerIds: UUIDType[]) {
  await db.delete(groupCourses).where(eq(groupCourses.groupId, groupId));
  await db.delete(studentCourses).where(inArray(studentCourses.studentId, learnerIds));
}

async function assignCourseWithDueDate({
  tenantId,
  groupId,
  courseId,
  assignedBy,
  learnerIds,
  dueInDays,
  completedLearners,
}: {
  tenantId: UUIDType;
  groupId: UUIDType;
  courseId: UUIDType;
  assignedBy: UUIDType | null;
  learnerIds: UUIDType[];
  dueInDays: number;
  completedLearners: number;
}) {
  const dueDate = addDays(new Date(), dueInDays);
  dueDate.setUTCHours(12, 0, 0, 0);

  await db.insert(groupCourses).values({
    tenantId,
    groupId,
    courseId,
    isMandatory: true,
    dueDate,
    enrolledBy: assignedBy,
  });

  await db.insert(studentCourses).values(
    learnerIds.map((studentId, index) => {
      const isCompleted = index < completedLearners;

      return {
        tenantId,
        studentId,
        courseId,
        enrolledByGroupId: groupId,
        status: COURSE_ENROLLMENT.ENROLLED,
        progress: isCompleted ? PROGRESS_STATUSES.COMPLETED : PROGRESS_STATUSES.NOT_STARTED,
        completedAt: isCompleted ? new Date().toISOString() : null,
      };
    }),
  );
}

seedCourseDueDates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding course due dates failed:", error);
    process.exit(1);
  });
