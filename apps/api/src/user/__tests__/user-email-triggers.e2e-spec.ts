import { COURSE_ENROLLMENT, SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, isNull, sql } from "drizzle-orm";
import { decode } from "html-entities";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { buildJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { UsersAssignedToCourseEvent } from "src/events/user/user-assigned-to-course.event";
import { UserChapterFinishedEvent } from "src/events/user/user-chapter-finished.event";
import { UserCourseFinishedEvent } from "src/events/user/user-course-finished.event";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import {
  DEFAULT_EMAIL_TRIGGERS,
  DEFAULT_GLOBAL_SETTINGS,
} from "src/settings/constants/settings.constants";
import { StatisticsService } from "src/statistics/statistics.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, settings, studentCourses } from "src/storage/schema";
import { NotifyUsersHandler } from "src/user/handlers/notify-users.handler";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { CourseTest } from "../../../test/factory/course.factory";
import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { UserEmailTriggersSchema } from "src/settings/schemas/settings.schema";

type TriggerKey = keyof UserEmailTriggersSchema;
type TriggerCase = {
  name: string;
  trigger: TriggerKey;
  createEvent: () =>
    | UserFirstLoginEvent
    | UsersAssignedToCourseEvent
    | UsersShortInactivityEvent
    | UsersLongInactivityEvent
    | UserChapterFinishedEvent
    | UserCourseFinishedEvent;
};
type InactivityEmailCase = {
  name: string;
  trigger: "userShortInactivity" | "userLongInactivity";
  createEvent: () => UsersShortInactivityEvent | UsersLongInactivityEvent;
  courseSubject: string;
  daysText: string;
  platformSubject: string;
};

const courseTitle = "Email Trigger Course";

describe("User email triggers (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: UUIDType;
  let emailAdapter: EmailTestingAdapter;
  let notifyUsersHandler: NotifyUsersHandler;
  let statisticsService: StatisticsService;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let student: UserWithCredentials;
  let course: CourseTest;
  let chapterId: UUIDType;

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    defaultTenantId = testContext.defaultTenantId;
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
    notifyUsersHandler = app.get(NotifyUsersHandler);
    statisticsService = app.get(StatisticsService);
    settingsFactory = createSettingsFactory(db);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
    emailAdapter.clearEmails();

    student = await userFactory.withUserSettings(db).create({
      email: "email-trigger-student@example.com",
      firstName: "Email",
      lastName: "Trigger",
      tenantId: defaultTenantId,
    });

    course = await courseFactory.create({
      authorId: student.id,
      title: courseTitle,
      description: "Email trigger course description",
      thumbnailS3Key: null,
    });

    const [chapter] = await db
      .insert(chapters)
      .values({
        authorId: student.id,
        courseId: course.id,
        displayOrder: 1,
        lessonCount: 1,
        title: buildJsonbField("en", "Email Trigger Chapter"),
      })
      .returning({ id: chapters.id });

    chapterId = chapter.id;

    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();

    await truncateTables(baseDb, [
      "student_courses",
      "chapters",
      "courses",
      "users",
      "settings",
      "categories",
    ]);
  });

  const cases: TriggerCase[] = [
    {
      name: "first login",
      trigger: "userFirstLogin",
      createEvent: () => new UserFirstLoginEvent({ userId: student.id }),
    },
    {
      name: "course assignment",
      trigger: "userCourseAssignment",
      createEvent: () =>
        new UsersAssignedToCourseEvent({ courseId: course.id, studentIds: [student.id] }),
    },
    {
      name: "short inactivity",
      trigger: "userShortInactivity",
      createEvent: () =>
        new UsersShortInactivityEvent({
          tenantId: defaultTenantId,
          users: [{ userId: student.id, name: student.firstName, email: student.email }],
        }),
    },
    {
      name: "long inactivity",
      trigger: "userLongInactivity",
      createEvent: () =>
        new UsersLongInactivityEvent({
          tenantId: defaultTenantId,
          users: [{ userId: student.id, name: student.firstName, email: student.email }],
        }),
    },
    {
      name: "chapter finished",
      trigger: "userChapterFinished",
      createEvent: () =>
        new UserChapterFinishedEvent({
          actor: {
            userId: student.id,
            email: student.email,
            roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
            permissions: [],
            tenantId: defaultTenantId,
          },
          chapterId,
          courseId: course.id,
          userId: student.id,
        }),
    },
    {
      name: "course finished",
      trigger: "userCourseFinished",
      createEvent: () =>
        new UserCourseFinishedEvent({
          actor: {
            userId: student.id,
            email: student.email,
            roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
            permissions: [],
            tenantId: defaultTenantId,
          },
          courseId: course.id,
          userId: student.id,
        }),
    },
  ];
  const inactivityEmailCases: InactivityEmailCase[] = [
    {
      name: "short inactivity",
      trigger: "userShortInactivity",
      createEvent: () =>
        new UsersShortInactivityEvent({
          tenantId: defaultTenantId,
          users: [{ userId: student.id, name: student.firstName, email: student.email }],
        }),
      courseSubject: "Continue your course - Email Trigger Course",
      daysText: "14 days since last activity",
      platformSubject: "Continue your journey on the platform",
    },
    {
      name: "long inactivity",
      trigger: "userLongInactivity",
      createEvent: () =>
        new UsersLongInactivityEvent({
          tenantId: defaultTenantId,
          users: [{ userId: student.id, name: student.firstName, email: student.email }],
        }),
      courseSubject: "Come back to your courses",
      daysText: "It's been 30 days since your last activity",
      platformSubject: "Come back to your courses",
    },
  ];

  it.each(cases)("sends the $name email when the trigger is enabled", async (testCase) => {
    await enableOnlyTrigger(testCase.trigger);

    await notifyUsersHandler.handle(testCase.createEvent());

    const [sentEmail] = emailAdapter.getAllEmails();

    expect(emailAdapter.getAllEmails()).toHaveLength(1);
    expect(sentEmail).toEqual(
      expect.objectContaining({
        to: student.email,
        html: expect.any(String),
        subject: expect.any(String),
        text: expect.any(String),
      }),
    );
    expect(sentEmail.subject).not.toBe("");
    expect(sentEmail.text).not.toBe("");
    expect(sentEmail.html).not.toBe("");
  });

  it.each(cases)("does not send the $name email when the trigger is disabled", async (testCase) => {
    await disableAllTriggers();

    await notifyUsersHandler.handle(testCase.createEvent());

    expect(emailAdapter.getAllEmails()).toHaveLength(0);
  });

  it.each(inactivityEmailCases)(
    "renders $name email wording on platform when no recent course is available",
    async (testCase) => {
      jest.spyOn(statisticsService, "getRecentCoursesForStudents").mockResolvedValue([]);
      await enableOnlyTrigger(testCase.trigger);

      await notifyUsersHandler.handle(testCase.createEvent());

      const sentEmail = getSingleSentEmail();
      const text = normalizeEmailText(sentEmail.text);
      const html = normalizeEmailHtml(sentEmail.html);

      expect(sentEmail.subject).toBe(testCase.platformSubject);
      expect(text).toContain(`${testCase.daysText} on platform`);
      expect(html).toContain(`${testCase.daysText} on platform`);
      expect(text).not.toContain(`in ${courseTitle}`);
    },
  );

  it.each(inactivityEmailCases)(
    "renders $name email wording in the recent course when a course is available",
    async (testCase) => {
      jest.spyOn(statisticsService, "getRecentCoursesForStudents").mockResolvedValue([
        {
          studentId: student.id,
          courseId: course.id,
          courseName: courseTitle,
        },
      ]);
      await enableOnlyTrigger(testCase.trigger);

      await notifyUsersHandler.handle(testCase.createEvent());

      const sentEmail = getSingleSentEmail();
      const text = normalizeEmailText(sentEmail.text);
      const html = normalizeEmailHtml(sentEmail.html);

      expect(sentEmail.subject).toBe(testCase.courseSubject);
      expect(text).toContain(`${testCase.daysText} in ${courseTitle}`);
      expect(html).toContain(`${testCase.daysText} in ${courseTitle}`);
      expect(text).not.toContain(`${testCase.daysText} on platform`);
    },
  );

  it("renders recipient-specific short inactivity wording for multiple recipients", async () => {
    const platformOnlyStudent = await userFactory.withUserSettings(db).create({
      email: "email-trigger-platform-recipient@example.com",
      firstName: "Platform",
      lastName: "Recipient",
      tenantId: defaultTenantId,
    });

    jest.spyOn(statisticsService, "getRecentCoursesForStudents").mockResolvedValue([
      {
        studentId: student.id,
        courseId: course.id,
        courseName: courseTitle,
      },
    ]);
    await enableOnlyTrigger("userShortInactivity");

    await notifyUsersHandler.handle(
      new UsersShortInactivityEvent({
        tenantId: defaultTenantId,
        users: [buildInactiveUser(student), buildInactiveUser(platformOnlyStudent)],
      }),
    );

    expect(emailAdapter.getAllEmails()).toHaveLength(2);

    const courseEmail = getSentEmailTo(student.email);
    const platformEmail = getSentEmailTo(platformOnlyStudent.email);

    expect(courseEmail.subject).toBe(`Continue your course - ${courseTitle}`);
    expect(normalizeEmailText(courseEmail.text)).toContain(
      `14 days since last activity in ${courseTitle}`,
    );
    expect(platformEmail.subject).toBe("Continue your journey on the platform");
    expect(normalizeEmailText(platformEmail.text)).toContain(
      "14 days since last activity on platform",
    );
  });

  it("falls back to disabled default email triggers when legacy global settings omit them", async () => {
    await removeUserEmailTriggersFromGlobalSettings();

    await expect(
      notifyUsersHandler.handle(new UserFirstLoginEvent({ userId: student.id })),
    ).resolves.toBeUndefined();

    expect(emailAdapter.getAllEmails()).toHaveLength(0);
  });

  it("renders localized short inactivity platform wording in the recipient language", async () => {
    await db
      .update(settings)
      .set({ settings: setJsonbField(settings.settings, "language", SUPPORTED_LANGUAGES.PL) })
      .where(eq(settings.userId, student.id));
    jest.spyOn(statisticsService, "getRecentCoursesForStudents").mockResolvedValue([]);
    await enableOnlyTrigger("userShortInactivity");

    await notifyUsersHandler.handle(
      new UsersShortInactivityEvent({
        tenantId: defaultTenantId,
        users: [buildInactiveUser(student)],
      }),
    );

    const sentEmail = getSingleSentEmail();
    const localizedText = "Minęło 14 dni od ostatniej aktywności na platformie";

    expect(sentEmail.subject).toBe("Kontynuuj naukę na platformie");
    expect(normalizeEmailText(sentEmail.text)).toContain(localizedText);
    expect(normalizeEmailHtml(sentEmail.html)).toContain(localizedText);
  });

  const enableOnlyTrigger = async (trigger: TriggerKey) => {
    await updateUserEmailTriggers({
      ...DEFAULT_EMAIL_TRIGGERS,
      [trigger]: true,
    });
  };

  const disableAllTriggers = async () => {
    await updateUserEmailTriggers(DEFAULT_EMAIL_TRIGGERS);
  };

  const updateUserEmailTriggers = async (userEmailTriggers: UserEmailTriggersSchema) => {
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_GLOBAL_SETTINGS,
          userEmailTriggers,
        }),
      })
      .where(isNull(settings.userId));
  };

  const removeUserEmailTriggersFromGlobalSettings = async () => {
    await db
      .update(settings)
      .set({ settings: sql`${settings.settings} - 'userEmailTriggers'` })
      .where(isNull(settings.userId));
  };

  const getSingleSentEmail = () => {
    const [sentEmail] = emailAdapter.getAllEmails();

    expect(emailAdapter.getAllEmails()).toHaveLength(1);

    return sentEmail;
  };

  const getSentEmailTo = (email: string) => {
    const sentEmail = emailAdapter.getAllEmails().find((sentEmail) => sentEmail.to === email);

    if (!sentEmail) throw new Error(`Expected email to ${email}`);

    return sentEmail;
  };

  const buildInactiveUser = (user: UserWithCredentials) => ({
    userId: user.id,
    name: user.firstName,
    email: user.email,
  });

  const normalizeEmailText = (text?: string) => text?.replace(/\s+/g, " ").trim() ?? "";

  const normalizeEmailHtml = (html?: string) => normalizeEmailText(decode(html ?? ""));
});
