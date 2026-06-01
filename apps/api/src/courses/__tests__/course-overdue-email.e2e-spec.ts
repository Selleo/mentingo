import { COURSE_ENROLLMENT } from "@repo/shared";
import { eq } from "drizzle-orm";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { CourseService } from "src/courses/course.service";
import { DEFAULT_ADMIN_SETTINGS } from "src/settings/constants/settings.constants";
import { groupCourses, settings, studentCourses } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateAllTables } from "../../../test/helpers/test-helpers";

import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

describe("Course overdue emails (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: string;
  let tenantRunner: TenantDbRunnerService;
  let courseService: CourseService;
  let emailAdapter: EmailTestingAdapter;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;

  beforeAll(async () => {
    const test = await createE2ETest();

    app = test.app;
    db = test.db;
    baseDb = test.dbAdmin;
    defaultTenantId = test.defaultTenantId;
    tenantRunner = test.tenantRunner;
    courseService = app.get(CourseService);
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);
    emailAdapter.clearEmails();
  });

  it("sends overdue course notification without ambiguous id query errors", async () => {
    const admin = await userFactory.withAdminSettings(db).create({
      email: "overdue-admin@example.com",
      firstName: "Overdue",
      lastName: "Admin",
    });
    const student = await userFactory.withUserSettings(db).create({
      email: "overdue-student@example.com",
      firstName: "Overdue",
      lastName: "Student",
    });
    const course = await courseFactory.create({
      authorId: admin.id,
      title: "Overdue Regression Course",
      description: "Course used to cover overdue notification aggregation",
    });
    const group = await groupFactory.withMembers([student.id]).create({
      name: "Overdue Regression Group",
    });

    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_ADMIN_SETTINGS,
          adminOverdueCourseNotification: true,
        }),
      })
      .where(eq(settings.userId, admin.id));

    await db.insert(groupCourses).values({
      courseId: course.id,
      groupId: group.id,
      dueDate: new Date("2026-05-05T12:00:00.000Z"),
      isMandatory: false,
      enrolledBy: admin.id,
    });

    await db.insert(studentCourses).values({
      courseId: course.id,
      studentId: student.id,
      enrolledByGroupId: group.id,
      status: COURSE_ENROLLMENT.ENROLLED,
    });

    await tenantRunner.runWithTenant(defaultTenantId, () =>
      courseService.sendOverdueCoursesEmails(),
    );

    const emails = emailAdapter.getAllEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: admin.email,
      subject: "Overdue courses notification",
    });
    expect(emails[0].text).toContain("Overdue Regression Course");
    expect(emails[0].text).toContain("Overdue Regression Group");
    expect(emails[0].text).toContain(student.email);
  });
});
