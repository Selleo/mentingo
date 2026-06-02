import { ANNOUNCEMENT_SOURCE_TYPES, COURSE_ENROLLMENT } from "@repo/shared";
import { addDays } from "date-fns";
import { eq } from "drizzle-orm";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { FileService } from "src/file/file.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { announcements, groupCourses, studentCourses, userAnnouncements } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CourseService } from "../course.service";

import type { CourseTest } from "../../../test/factory/course.factory";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Course due date reminders (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let courseService: CourseService;
  let emailAdapter: EmailTestingAdapter;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;

  beforeAll(async () => {
    const mockFileService = {
      getFileUrl: jest.fn().mockResolvedValue("http://example.com/file"),
      getRawFileBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-file-content")),
      isBunnyConfigured: jest.fn().mockResolvedValue(false),
    };

    const { app: testApp } = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    courseService = app.get(CourseService);
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
    settingsFactory = createSettingsFactory(db);
    userFactory = createUserFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
    emailAdapter.clearEmails();
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "user_announcements",
      "announcements",
      "courses",
      "student_courses",
      "group_courses",
      "group_users",
      "groups",
      "users",
      "settings",
      "categories",
    ]);
  });

  it("emails and announces to students 7 and 1 days before mandatory course due dates", async () => {
    const studentDueInSevenDays = await createStudent();
    const studentDueTomorrow = await createStudent();
    const optionalCourseStudent = await createStudent();
    const completedCourseStudent = await createStudent();
    const farDueDateStudent = await createStudent();

    const dueInSevenDaysCourse = await createGroupCourseEnrollment({
      student: studentDueInSevenDays,
      title: "Mandatory course due in seven days",
      dueInDays: 7,
      isMandatory: true,
    });
    const dueTomorrowCourse = await createGroupCourseEnrollment({
      student: studentDueTomorrow,
      title: "Mandatory course due tomorrow",
      dueInDays: 1,
      isMandatory: true,
    });
    await createGroupCourseEnrollment({
      student: optionalCourseStudent,
      title: "Optional course due in seven days",
      dueInDays: 7,
      isMandatory: false,
    });
    await createGroupCourseEnrollment({
      student: completedCourseStudent,
      title: "Completed mandatory course due in seven days",
      dueInDays: 7,
      isMandatory: true,
      completed: true,
    });
    await createGroupCourseEnrollment({
      student: farDueDateStudent,
      title: "Mandatory course due in three days",
      dueInDays: 3,
      isMandatory: true,
    });

    await courseService.sendCourseDueDateReminders();

    const sentEmails = emailAdapter.getAllEmails();
    expect(sentEmails).toHaveLength(2);
    expect(sentEmails.map((email) => email.to).sort()).toEqual(
      [studentDueInSevenDays.email, studentDueTomorrow.email].sort(),
    );
    expect(sentEmails.map((email) => email.subject)).toEqual(
      expect.arrayContaining([
        `Course deadline approaching - ${dueInSevenDaysCourse.title}`,
        `Course deadline approaching - ${dueTomorrowCourse.title}`,
      ]),
    );

    const dueInSevenDaysEmail = sentEmails.find(
      (email) => email.to === studentDueInSevenDays.email,
    );
    const dueTomorrowEmail = sentEmails.find((email) => email.to === studentDueTomorrow.email);
    const dueInSevenDaysEmailText = normalizeEmailText(dueInSevenDaysEmail?.text);
    const dueTomorrowEmailText = normalizeEmailText(dueTomorrowEmail?.text);

    expect(dueInSevenDaysEmailText).toContain("Course deadline approaching");
    expect(dueInSevenDaysEmailText).toContain(
      `The deadline to complete course "${dueInSevenDaysCourse.title}" is in 7 days.`,
    );
    expect(dueTomorrowEmailText).toContain("Course deadline approaching");
    expect(dueTomorrowEmailText).toContain(
      `The deadline to complete course "${dueTomorrowCourse.title}" is tomorrow.`,
    );

    const announcementRows = await db
      .select({
        userId: userAnnouncements.userId,
        title: announcements.title,
        content: announcements.content,
        sourceType: announcements.sourceType,
        sourceId: announcements.sourceId,
        sendEmail: announcements.sendEmail,
      })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId));

    expect(announcementRows).toHaveLength(2);
    expect(announcementRows.map((announcement) => announcement.userId).sort()).toEqual(
      [studentDueInSevenDays.id, studentDueTomorrow.id].sort(),
    );
    expect(announcementRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          userId: studentDueInSevenDays.id,
          title: { en: "Course deadline approaching" },
          content: {
            en: `The deadline to complete course "${dueInSevenDaysCourse.title}" is in 7 days.`,
          },
          sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_DUE_DATE_REMINDER,
          sourceId: dueInSevenDaysCourse.id,
          sendEmail: false,
        }),
        expect.objectContaining({
          userId: studentDueTomorrow.id,
          title: { en: "Course deadline approaching" },
          content: {
            en: `The deadline to complete course "${dueTomorrowCourse.title}" is tomorrow.`,
          },
          sourceType: ANNOUNCEMENT_SOURCE_TYPES.COURSE_DUE_DATE_REMINDER,
          sourceId: dueTomorrowCourse.id,
          sendEmail: false,
        }),
      ]),
    );
  });

  const normalizeEmailText = (text?: string) => text?.replace(/\s+/g, " ").trim() ?? "";

  const createStudent = () => userFactory.withUserSettings(db).create();

  const createReminderDate = (daysFromNow: number) => {
    const date = addDays(new Date(), daysFromNow);
    date.setHours(12, 0, 0, 0);
    return date;
  };

  const createGroupCourseEnrollment = async ({
    student,
    title,
    dueInDays,
    isMandatory,
    completed = false,
  }: {
    student: UserWithCredentials;
    title: string;
    dueInDays: number;
    isMandatory: boolean;
    completed?: boolean;
  }): Promise<CourseTest> => {
    const course = await courseFactory.create({
      title,
      description: `${title} description`,
      thumbnailS3Key: null,
    });
    const group = await groupFactory.withMembers([student.id]).create();

    await db.insert(groupCourses).values({
      groupId: group.id,
      courseId: course.id,
      isMandatory,
      dueDate: createReminderDate(dueInDays),
    });
    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      enrolledByGroupId: group.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      completedAt: completed ? new Date().toISOString() : null,
    });

    return course;
  };
});
