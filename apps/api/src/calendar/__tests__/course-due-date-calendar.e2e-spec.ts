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

    expect(new Date(updatedExistingEvent.startsAt).toISOString()).toBe("2026-02-10T00:00:00.000Z");
    expect(new Date(updatedExistingEvent.endsAt).toISOString()).toBe("2026-02-11T00:00:00.000Z");
    expect(updatedExistingEvent).toEqual(
      expect.objectContaining({
        uid: getUid(course.id, groupWithExistingEvent.id),
        sequence: 1,
      }),
    );
    expect(missingGroupCourse?.calendarEventId).toEqual(expect.any(String));

    const [createdCalendarEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, missingGroupCourse?.calendarEventId as string));

    expect(new Date(createdCalendarEvent.startsAt).toISOString()).toBe("2026-02-11T00:00:00.000Z");
    expect(new Date(createdCalendarEvent.endsAt).toISOString()).toBe("2026-02-12T00:00:00.000Z");
    expect(createdCalendarEvent).toEqual(
      expect.objectContaining({
        uid: getUid(course.id, groupWithoutEvent.id),
        sequence: 0,
      }),
    );
  });

  it("reactivates a cancelled due-date event instead of creating a duplicate uid", async () => {
    const course = await courseFactory.create({ title: "Reactivated due-date course" });
    const group = await groupFactory.create();
    const dueDate = new Date("2026-03-15T12:00:00.000Z");
    const uid = getUid(course.id, group.id);

    const [cancelledCalendarEvent] = await db
      .insert(calendarEvents)
      .values({
        uid,
        sequence: 3,
        status: CALENDAR_EVENT_STATUSES.CANCELLED,
        baseLanguage: SUPPORTED_LANGUAGES.EN,
        availableLocales: [SUPPORTED_LANGUAGES.EN],
        title: buildJsonbField(SUPPORTED_LANGUAGES.EN, "Cancelled title"),
        description: null,
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-02T00:00:00.000Z",
        allDay: true,
        timezone: "UTC",
        location: null,
        organizerUserId: null,
        rrule: null,
        exdates: null,
        deletedAt: "2026-01-05T00:00:00.000Z",
      })
      .returning({ id: calendarEvents.id });

    await db.insert(groupCourses).values({
      groupId: group.id,
      courseId: course.id,
      isMandatory: true,
      dueDate,
      calendarEventId: null,
    });

    await service.syncGroupCourseDueDates(course.id, [group.id]);

    const eventsWithUid = await db.select().from(calendarEvents).where(eq(calendarEvents.uid, uid));
    const [groupCourse] = await db
      .select({ calendarEventId: groupCourses.calendarEventId })
      .from(groupCourses)
      .where(eq(groupCourses.groupId, group.id));

    expect(eventsWithUid).toHaveLength(1);
    expect(new Date(eventsWithUid[0].startsAt).toISOString()).toBe("2026-03-15T00:00:00.000Z");
    expect(new Date(eventsWithUid[0].endsAt).toISOString()).toBe("2026-03-16T00:00:00.000Z");
    expect(eventsWithUid[0]).toEqual(
      expect.objectContaining({
        id: cancelledCalendarEvent.id,
        sequence: 4,
        status: CALENDAR_EVENT_STATUSES.SCHEDULED,
        deletedAt: null,
      }),
    );
    expect(groupCourse.calendarEventId).toBe(cancelledCalendarEvent.id);
  });

  const getUid = (courseId: string, groupId: string) => `course-due-date:${courseId}:${groupId}`;
});
