import { faker } from "@faker-js/faker";
import {
  CALENDAR_EVENT_SOURCE_TYPES,
  COURSE_ENROLLMENT,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";
import { match } from "ts-pattern";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { calendarEvents, groupCourses, studentCourses } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";
import { waitForOutbox } from "../../../test/helpers/wait-for-outbox";

import {
  CALENDAR_RANGE,
  GROUP_DUE_DATE,
  GROUP_ENROLLMENT_COURSE_CONTENT,
  GROUP_ENROLLMENT_REJECTION_CASES,
  GROUP_MEMBER_ENROLLMENT_CASES,
  GROUP_REQUEST_REJECTIONS,
  GROUP_UNENROLLMENT_REJECTION_CASES,
  UPDATED_GROUP_DUE_DATE,
} from "./course-group-enrollment.scenarios";

import type { GroupRequestRejection } from "./course-group-enrollment.scenarios";
import type { CalendarEventTestResponse } from "./types/calendar-event-test.types";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { SignedInUser } from "test/helpers/course-enrollment";

export const COURSE_GROUP_ENROLLMENT_TABLES: Parameters<typeof truncateTables>[1] = [
  ...COURSE_ENROLLMENT_TABLES,
  "calendar_outbound_events",
  "calendar_events",
  "outbox_events",
];

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

type GroupAssignment = { id: UUIDType; isMandatory: boolean; dueDate: string | null };

describe("Course group enrollment (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_GROUP_ENROLLMENT_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_GROUP_ENROLLMENT_TABLES);
  });

  const enrollGroups = (
    cookies: string | null,
    courseId: UUIDType,
    groups: GroupAssignment[],
    expectedStatus = 201,
  ) => {
    const enrollRequest = request(app.getHttpServer())
      .post(`/api/course/${courseId}/enroll-groups-to-course`)
      .send({ groups });

    return (cookies ? enrollRequest.set("Cookie", cookies) : enrollRequest).expect(expectedStatus);
  };

  const unenrollGroups = (
    cookies: string | null,
    courseId: UUIDType,
    groupIds: UUIDType[],
    expectedStatus = 200,
  ) => {
    const unenrollRequest = request(app.getHttpServer())
      .delete(`/api/course/${courseId}/unenroll-groups-from-course`)
      .send({ groupIds });

    return (cookies ? unenrollRequest.set("Cookie", cookies) : unenrollRequest).expect(
      expectedStatus,
    );
  };

  const optionalAssignment = (groupId: UUIDType): GroupAssignment => ({
    id: groupId,
    isMandatory: false,
    dueDate: null,
  });

  const mandatoryAssignment = (
    groupId: UUIDType,
    dueDate: string | null = GROUP_DUE_DATE,
  ): GroupAssignment => ({
    id: groupId,
    isMandatory: true,
    dueDate,
  });

  const arrangeCourse = (authorId: UUIDType) =>
    helpers
      .arrangeCourseWithContent({ authorId, contentShape: GROUP_ENROLLMENT_COURSE_CONTENT })
      .then(({ course }) => course);

  const arrangeDirectEnrollments = (studentIds: UUIDType[], courseId: UUIDType) =>
    runInTenant(async () => {
      for (const studentId of studentIds) {
        await createStudentCourseFactory(db).create({ studentId, courseId });
      }
    });

  const findGroupAssignment = (groupId: UUIDType, courseId: UUIDType) =>
    runInTenant(async () => {
      const [groupCourse] = await db
        .select({
          isMandatory: groupCourses.isMandatory,
          enrolledBy: groupCourses.enrolledBy,
          dueDate: groupCourses.dueDate,
        })
        .from(groupCourses)
        .where(and(eq(groupCourses.groupId, groupId), eq(groupCourses.courseId, courseId)));

      return groupCourse;
    });

  const findCourseEnrollments = (courseId: UUIDType) =>
    runInTenant(() =>
      db
        .select({
          studentId: studentCourses.studentId,
          status: studentCourses.status,
          enrolledByGroupId: studentCourses.enrolledByGroupId,
        })
        .from(studentCourses)
        .where(eq(studentCourses.courseId, courseId)),
    );

  const findCalendarEventDeletedAt = (eventId: UUIDType) =>
    runInTenant(async () => {
      const [calendarEvent] = await db
        .select({ deletedAt: calendarEvents.deletedAt })
        .from(calendarEvents)
        .where(eq(calendarEvents.id, eventId));

      return calendarEvent?.deletedAt;
    });

  const getCalendarEvents = async (viewer: SignedInUser): Promise<CalendarEventTestResponse[]> => {
    const response = await request(app.getHttpServer())
      .get("/api/calendar/events")
      .query({ ...CALENDAR_RANGE, language: SUPPORTED_LANGUAGES.EN, timezone: "UTC" })
      .set("Cookie", viewer.cookies)
      .expect(200);

    return response.body.data.events;
  };

  const waitForCalendarEventCount = (viewer: SignedInUser, expectedCount: number) =>
    waitForOutbox(
      app,
      () => getCalendarEvents(viewer),
      (events) => events.length === expectedCount,
    );

  const courseDueDateEvent = (courseId: UUIDType, groupId: UUIDType) =>
    expect.objectContaining({
      sourceType: CALENDAR_EVENT_SOURCE_TYPES.COURSE_DUE_DATE,
      payload: { courseDueDate: expect.objectContaining({ courseId, groupId }) },
    });

  const arrangeRejectedGroupRequest = async (
    rejection: GroupRequestRejection,
  ): Promise<{ cookies: string | null; courseId: UUIDType; groupId: UUIDType }> =>
    match(rejection)
      .with(GROUP_REQUEST_REJECTIONS.ANONYMOUS, async () => ({
        cookies: null,
        courseId: faker.string.uuid(),
        groupId: faker.string.uuid(),
      }))
      .with(GROUP_REQUEST_REJECTIONS.STUDENT, async () => {
        const admin = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const student = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
        const course = await arrangeCourse(admin.id);

        return { cookies: student.cookies, courseId: course.id, groupId: faker.string.uuid() };
      })
      .with(GROUP_REQUEST_REJECTIONS.MISSING_COURSE, async () => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);

        return {
          cookies: admin.cookies,
          courseId: faker.string.uuid(),
          groupId: faker.string.uuid(),
        };
      })
      .with(GROUP_REQUEST_REJECTIONS.GROUP_NOT_ENROLLED, async () => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await arrangeCourse(admin.user.id);
        const group = await helpers.arrangeGroupWithMembers([]);

        return { cookies: admin.cookies, courseId: course.id, groupId: group.id };
      })
      .exhaustive();

  describe("POST /api/course/:courseId/enroll-groups-to-course", () => {
    it.each(GROUP_ENROLLMENT_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus }) => {
        const { cookies, courseId } = await arrangeRejectedGroupRequest(rejection);

        await enrollGroups(cookies, courseId, [], expectedStatus);
      },
    );

    it("stores who assigned the group, its due date and whether it is mandatory", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([]);

      await enrollGroups(admin.cookies, course.id, [mandatoryAssignment(group.id)]);

      expect(await findGroupAssignment(group.id, course.id)).toEqual({
        isMandatory: true,
        enrolledBy: admin.user.id,
        dueDate: new Date(GROUP_DUE_DATE),
      });
    });

    it("updates the assignment when the group is enrolled again", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([]);

      await enrollGroups(admin.cookies, course.id, [mandatoryAssignment(group.id)]);
      await enrollGroups(admin.cookies, course.id, [
        { id: group.id, isMandatory: false, dueDate: UPDATED_GROUP_DUE_DATE },
      ]);

      expect(await findGroupAssignment(group.id, course.id)).toMatchObject({
        isMandatory: false,
        dueDate: new Date(UPDATED_GROUP_DUE_DATE),
      });
    });

    it("enrolls course managers in the group except the course author", async () => {
      const author = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const courseManager = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(author.user.id);
      const group = await helpers.arrangeGroupWithMembers([author.user.id, courseManager.id]);

      await enrollGroups(author.cookies, course.id, [mandatoryAssignment(group.id, null)]);

      expect(await findCourseEnrollments(course.id)).toEqual([
        {
          studentId: courseManager.id,
          status: COURSE_ENROLLMENT.ENROLLED,
          enrolledByGroupId: group.id,
        },
      ]);
    });

    it.each(GROUP_MEMBER_ENROLLMENT_CASES)(
      "attributes every member's enrollment to the group when $members",
      async ({ memberCount, directlyEnrolledCount }) => {
        const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
        const course = await arrangeCourse(admin.user.id);
        const memberIds = [];
        for (let memberIndex = 0; memberIndex < memberCount; memberIndex += 1) {
          memberIds.push((await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT)).id);
        }
        const group = await helpers.arrangeGroupWithMembers(memberIds);
        await arrangeDirectEnrollments(memberIds.slice(0, directlyEnrolledCount), course.id);

        await enrollGroups(admin.cookies, course.id, [optionalAssignment(group.id)]);

        expect(await findCourseEnrollments(course.id)).toEqual(
          expect.arrayContaining(
            memberIds.map((studentId) => ({
              studentId,
              status: COURSE_ENROLLMENT.ENROLLED,
              enrolledByGroupId: group.id,
            })),
          ),
        );
        expect(await findCourseEnrollments(course.id)).toHaveLength(memberCount);
      },
    );

    it("enrolls users who join the group after it was assigned", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([]);
      const newMember = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);

      await enrollGroups(admin.cookies, course.id, [optionalAssignment(group.id)]);
      await request(app.getHttpServer())
        .post("/api/group/set")
        .query({ userId: newMember.id })
        .send([group.id])
        .set("Cookie", admin.cookies)
        .expect(201);

      expect(await helpers.findStudentEnrollment(newMember.id, course.id)).toMatchObject({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId: group.id,
      });
    });

    it("shows the course due date in the calendar of group members only", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const firstMember = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const secondMember = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const outsider = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([
        firstMember.user.id,
        secondMember.user.id,
      ]);

      await enrollGroups(admin.cookies, course.id, [mandatoryAssignment(group.id)]);

      expect({
        firstMember: await waitForCalendarEventCount(firstMember, 1),
        secondMember: await getCalendarEvents(secondMember),
        outsider: await getCalendarEvents(outsider),
      }).toEqual({
        firstMember: [courseDueDateEvent(course.id, group.id)],
        secondMember: [courseDueDateEvent(course.id, group.id)],
        outsider: [],
      });
    });
  });

  describe("DELETE /api/course/:courseId/unenroll-groups-from-course", () => {
    it.each(GROUP_UNENROLLMENT_REJECTION_CASES)(
      "rejects with $expectedStatus when $rejection",
      async ({ rejection, expectedStatus }) => {
        const { cookies, courseId, groupId } = await arrangeRejectedGroupRequest(rejection);

        await unenrollGroups(cookies, courseId, [groupId], expectedStatus);
      },
    );

    it("removes the group assignment and unenrolls its members", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([student.id]);

      await enrollGroups(admin.cookies, course.id, [optionalAssignment(group.id)]);
      await unenrollGroups(admin.cookies, course.id, [group.id]);

      expect({
        groupAssignment: await findGroupAssignment(group.id, course.id),
        enrollment: await helpers.findStudentEnrollment(student.id, course.id),
      }).toEqual({
        groupAssignment: undefined,
        enrollment: {
          status: COURSE_ENROLLMENT.NOT_ENROLLED,
          enrolledAt: null,
          enrolledByGroupId: null,
          paymentId: null,
        },
      });
    });

    it("keeps members enrolled through another assigned group", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const student = await helpers.arrangeUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await arrangeCourse(admin.user.id);
      const firstGroup = await helpers.arrangeGroupWithMembers([student.id]);
      const secondGroup = await helpers.arrangeGroupWithMembers([student.id]);

      await enrollGroups(admin.cookies, course.id, [optionalAssignment(firstGroup.id)]);
      await enrollGroups(admin.cookies, course.id, [optionalAssignment(secondGroup.id)]);
      await unenrollGroups(admin.cookies, course.id, [firstGroup.id]);

      expect(await helpers.findStudentEnrollment(student.id, course.id)).toMatchObject({
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId: secondGroup.id,
      });
    });

    it("removes the course due date from members' calendars", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const member = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const course = await arrangeCourse(admin.user.id);
      const group = await helpers.arrangeGroupWithMembers([member.user.id]);

      await enrollGroups(admin.cookies, course.id, [mandatoryAssignment(group.id)]);
      const [dueDateEvent] = await waitForCalendarEventCount(member, 1);
      await unenrollGroups(admin.cookies, course.id, [group.id]);

      expect({
        memberEvents: await waitForCalendarEventCount(member, 0),
        deletedAt: await findCalendarEventDeletedAt(dueDateEvent.id),
      }).toEqual({
        memberEvents: [],
        deletedAt: expect.anything(),
      });
    });
  });
});
