import { CALENDAR_EVENT_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { eq } from "drizzle-orm";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { calendarEvents, groupCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { CourseDueDateCalendarService } from "../course-due-date-calendar.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CourseDueDateCalendarService (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let service: CourseDueDateCalendarService;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    service = app.get(CourseDueDateCalendarService);
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "calendar_events",
      "group_courses",
      "groups",
      "courses",
      "categories",
    ]);
  });

  it("updates existing due-date events and creates missing ones in one sync", async () => {
    const course = await courseFactory.create({ title: "Batch synced course" });
    const groupWithExistingEvent = await groupFactory.create();
    const groupWithoutEvent = await groupFactory.create();
    const existingDueDate = new Date("2026-02-10T12:00:00.000Z");
    const missingDueDate = new Date("2026-02-11T12:00:00.000Z");

    const [existingCalendarEvent] = await db
      .insert(calendarEvents)
      .values({
        uid: getUid(course.id, groupWithExistingEvent.id),
        sequence: 0,
        status: CALENDAR_EVENT_STATUSES.SCHEDULED,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
        title: buildJsonbField(SUPPORTED_LANGUAGES.EN, "Old title"),
        description: null,
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-02T00:00:00.000Z",
        allDay: true,
        timezone: "UTC",
        location: null,
        organizerUserId: null,
        rrule: null,
        exdates: null,
        deletedAt: null,
      })
      .returning({ id: calendarEvents.id });

    await db.insert(groupCourses).values([
      {
        groupId: groupWithExistingEvent.id,
        courseId: course.id,
        isMandatory: true,
        dueDate: existingDueDate,
        calendarEventId: existingCalendarEvent.id,
      },
      {
        groupId: groupWithoutEvent.id,
        courseId: course.id,
        isMandatory: true,
        dueDate: missingDueDate,
        calendarEventId: null,
      },
    ]);

    await service.syncGroupCourseDueDates(course.id, [
      groupWithExistingEvent.id,
      groupWithoutEvent.id,
    ]);

    const [updatedExistingEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, existingCalendarEvent.id));
    const groupCourseRows = await db
      .select({
        groupId: groupCourses.groupId,
        calendarEventId: groupCourses.calendarEventId,
      })
      .from(groupCourses);
    const missingGroupCourse = groupCourseRows.find(
      (groupCourse) => groupCourse.groupId === groupWithoutEvent.id,
    );

    expect(updatedExistingEvent).toEqual(
      expect.objectContaining({
        startsAt: "2026-02-10T00:00:00.000Z",
        endsAt: "2026-02-11T00:00:00.000Z",
        uid: getUid(course.id, groupWithExistingEvent.id),
      }),
    );
    expect(missingGroupCourse?.calendarEventId).toEqual(expect.any(String));

    const [createdCalendarEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, missingGroupCourse?.calendarEventId as string));

    expect(createdCalendarEvent).toEqual(
      expect.objectContaining({
        startsAt: "2026-02-11T00:00:00.000Z",
        endsAt: "2026-02-12T00:00:00.000Z",
        uid: getUid(course.id, groupWithoutEvent.id),
      }),
    );
  });

  const getUid = (courseId: string, groupId: string) => `course-due-date:${courseId}:${groupId}`;
});
