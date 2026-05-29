import {
  CALENDAR_EVENT_STATUSES,
  CALENDAR_EVENT_SOURCE_TYPES,
  COURSE_ENROLLMENT,
  ENTITY_TYPES,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  SYSTEM_ROLE_SLUGS,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  calendarEvents,
  liveLessons,
  liveTrainingLinks,
  liveTrainingSessions,
  liveTrainings,
  resourceEntity,
  resources,
  settings,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { UserWithCredentials } from "test/factory/user.factory";

describe("LiveTrainingController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let defaultTenantId: UUIDType;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  const password = "password123";
  const language = SUPPORTED_LANGUAGES.EN;
  const timezone = "Europe/Warsaw";
  const getFutureDateOnScheduleStep = (minutesFromNow: number) => {
    const date = new Date();
    const currentMinutes = date.getMinutes();
    const minutesToNextStep = (5 - (currentMinutes % 5)) % 5;

    date.setMinutes(currentMinutes + minutesToNextStep + minutesFromNow, 0, 0);

    return date.toISOString();
  };

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    defaultTenantId = testContext.defaultTenantId;
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterEach(async () => {
    await truncateAllTables(baseDb, db);
  });

  afterAll(async () => {
    await app.close();
  });

  const enableLiveTraining = async () => {
    await db
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          calendarEnabled: true,
          liveTrainingEnabled: true,
        }),
      })
      .where(isNull(settings.userId));
  };

  const createAdmin = async () => {
    return userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({
        email: `admin-${crypto.randomUUID()}@example.com`,
        tenantId: defaultTenantId,
      });
  };

  const createStudent = async () => {
    return userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({
        email: `student-${crypto.randomUUID()}@example.com`,
        tenantId: defaultTenantId,
      });
  };

  const createTrainer = async () => {
    const trainer = await userFactory.withCredentials({ password }).create({
      email: `trainer-${crypto.randomUUID()}@example.com`,
      tenantId: defaultTenantId,
      roleSlug: SYSTEM_ROLE_SLUGS.TRAINER,
    });

    await createSettingsFactory(db, trainer.id, false).create();

    return trainer;
  };

  const createTestCourse = async (authorId: UUIDType) => {
    return courseFactory.create({
      authorId,
      title: `Live Training Course ${crypto.randomUUID()}`,
      baseLanguage: language,
      availableLocales: [language],
    });
  };

  const createTestResource = async (uploadedBy: UUIDType, title: string) => {
    const [resource] = await db
      .insert(resources)
      .values({
        title: buildJsonbField(language, title),
        description: buildJsonbField(language, `${title} description`),
        reference: `${crypto.randomUUID()}.pdf`,
        contentType: "application/pdf",
        metadata: { size: 1024 },
        uploadedBy,
      })
      .returning();

    return resource;
  };

  const createOfflineLiveTraining = async (admin: UserWithCredentials, courseId?: UUIDType) => {
    const startsAt = getFutureDateOnScheduleStep(60);
    const endsAt = getFutureDateOnScheduleStep(120);

    const response = await request(app.getHttpServer())
      .post("/api/live-training")
      .set("Cookie", await cookieFor(admin, app))
      .send({
        language,
        title: "Offline product training",
        description: "Preparation session",
        startsAt,
        endsAt,
        timezone,
        location: "Room 12",
        deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
        maxParticipants: 24,
        linkedCourseIds: courseId ? [courseId] : undefined,
      })
      .expect(201);

    return response.body.data;
  };

  beforeEach(async () => {
    await enableLiveTraining();
  });

  it("creates live training with calendar event, course link, and before/after resources", async () => {
    const admin = await createAdmin();
    const course = await createTestCourse(admin.id);
    const beforeResource = await createTestResource(admin.id, "Before deck");
    const afterResource = await createTestResource(admin.id, "After deck");
    const startsAt = getFutureDateOnScheduleStep(60);
    const endsAt = getFutureDateOnScheduleStep(120);

    const response = await request(app.getHttpServer())
      .post("/api/live-training")
      .set("Cookie", await cookieFor(admin, app))
      .send({
        language,
        title: "Live Training kickoff",
        description: "Initial live session",
        startsAt,
        endsAt,
        timezone,
        location: "Room A",
        deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
        maxParticipants: 42,
        linkedCourseIds: [course.id],
        beforeResourceIds: [beforeResource.id],
        afterResourceIds: [afterResource.id],
      })
      .expect(201);

    const liveTraining = response.body.data;

    expect(liveTraining.title).toBe("Live Training kickoff");
    expect(liveTraining.location).toBe("Room A");
    expect(liveTraining.linkedCourseIds).toEqual([course.id]);
    expect(liveTraining.materials.before).toHaveLength(1);
    expect(liveTraining.materials.after).toHaveLength(1);

    const [calendarEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, liveTraining.calendarEventId));

    expect(calendarEvent).toMatchObject({
      status: CALENDAR_EVENT_STATUSES.SCHEDULED,
      sequence: 0,
      location: "Room A",
      organizerUserId: admin.id,
    });
    expect(calendarEvent.title).toMatchObject({ [language]: "Live Training kickoff" });

    const [courseLink] = await db
      .select()
      .from(liveTrainingLinks)
      .where(
        and(
          eq(liveTrainingLinks.liveTrainingId, liveTraining.id),
          eq(liveTrainingLinks.entityType, LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE),
          eq(liveTrainingLinks.entityId, course.id),
        ),
      );

    expect(courseLink).toBeDefined();

    const resourceLinks = await db
      .select()
      .from(resourceEntity)
      .where(eq(resourceEntity.entityId, liveTraining.id));

    expect(resourceLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: beforeResource.id,
          entityType: ENTITY_TYPES.LIVE_TRAINING,
          relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.BEFORE,
        }),
        expect.objectContaining({
          resourceId: afterResource.id,
          entityType: ENTITY_TYPES.LIVE_TRAINING,
          relationshipType: LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES.AFTER,
        }),
      ]),
    );
  });

  it("updates paired calendar event and increments sequence for visible calendar changes", async () => {
    const admin = await createAdmin();
    const liveTraining = await createOfflineLiveTraining(admin);
    const nextStartsAt = getFutureDateOnScheduleStep(180);
    const nextEndsAt = getFutureDateOnScheduleStep(240);

    await request(app.getHttpServer())
      .patch(`/api/live-training/${liveTraining.id}`)
      .set("Cookie", await cookieFor(admin, app))
      .send({
        language,
        title: "Updated offline training",
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        location: "Room 15",
      })
      .expect(200);

    const [calendarEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, liveTraining.calendarEventId));

    expect(calendarEvent.sequence).toBe(1);
    expect(new Date(calendarEvent.startsAt).toISOString()).toBe(nextStartsAt);
    expect(new Date(calendarEvent.endsAt).toISOString()).toBe(nextEndsAt);
    expect(calendarEvent.location).toBe("Room 15");
    expect(calendarEvent.title).toMatchObject({ [language]: "Updated offline training" });
  });

  it("rejects course links from trainers without course management access", async () => {
    const admin = await createAdmin();
    const trainer = await createTrainer();
    const course = await createTestCourse(admin.id);
    const startsAt = getFutureDateOnScheduleStep(60);
    const endsAt = getFutureDateOnScheduleStep(120);

    await request(app.getHttpServer())
      .post("/api/live-training")
      .set("Cookie", await cookieFor(trainer, app))
      .send({
        language,
        title: "Unauthorized course link",
        startsAt,
        endsAt,
        timezone,
        deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
        linkedCourseIds: [course.id],
      })
      .expect(403);

    const liveTraining = await createOfflineLiveTraining(trainer);

    await request(app.getHttpServer())
      .patch(`/api/live-training/${liveTraining.id}`)
      .set("Cookie", await cookieFor(trainer, app))
      .send({
        language,
        linkedCourseIds: [course.id],
      })
      .expect(403);
  });

  it("does not expose course-linked live trainings to unrelated trainers", async () => {
    const admin = await createAdmin();
    const unrelatedTrainer = await createTrainer();
    const course = await createTestCourse(admin.id);
    const liveTraining = await createOfflineLiveTraining(admin, course.id);

    await request(app.getHttpServer())
      .get(`/api/live-training/${liveTraining.id}`)
      .query({ language })
      .set("Cookie", await cookieFor(unrelatedTrainer, app))
      .expect(404);

    const response = await request(app.getHttpServer())
      .get("/api/calendar/events")
      .query({
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 24 * 60 * 60 * 1000 * 7).toISOString(),
        language,
        timezone,
      })
      .set("Cookie", await cookieFor(unrelatedTrainer, app))
      .expect(200);

    expect(response.body.data.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: liveTraining.calendarEventId })]),
    );
  });

  it("soft deletes live training and cancels paired calendar event", async () => {
    const admin = await createAdmin();
    const liveTraining = await createOfflineLiveTraining(admin);

    await request(app.getHttpServer())
      .delete(`/api/live-training/${liveTraining.id}`)
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    const [deletedLiveTraining] = await db
      .select()
      .from(liveTrainings)
      .where(eq(liveTrainings.id, liveTraining.id));
    const [deletedCalendarEvent] = await db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.id, liveTraining.calendarEventId));

    expect(deletedLiveTraining.status).toBe(LIVE_TRAINING_STATUSES.CANCELLED);
    expect(deletedLiveTraining.deletedAt).not.toBeNull();
    expect(deletedCalendarEvent.status).toBe(CALENDAR_EVENT_STATUSES.CANCELLED);
    expect(deletedCalendarEvent.deletedAt).not.toBeNull();
    expect(deletedCalendarEvent.sequence).toBe(1);
  });

  it("returns linked course calendar events only to enrolled students", async () => {
    const admin = await createAdmin();
    const enrolledStudent = await createStudent();
    const unrelatedStudent = await createStudent();
    const course = await createTestCourse(admin.id);
    const liveTraining = await createOfflineLiveTraining(admin, course.id);

    await db.insert(studentCourses).values({
      courseId: course.id,
      studentId: enrolledStudent.id,
      status: COURSE_ENROLLMENT.ENROLLED,
    });

    const query = {
      start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(Date.now() + 24 * 60 * 60 * 1000 * 7).toISOString(),
      language,
      timezone,
    };

    const enrolledResponse = await request(app.getHttpServer())
      .get("/api/calendar/events")
      .query(query)
      .set("Cookie", await cookieFor(enrolledStudent, app))
      .expect(200);

    expect(enrolledResponse.body.data.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: liveTraining.calendarEventId,
          sourceId: liveTraining.id,
          sourceType: CALENDAR_EVENT_SOURCE_TYPES.LIVE_TRAINING,
          payload: expect.objectContaining({
            liveTraining: expect.objectContaining({
              deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
            }),
          }),
        }),
      ]),
    );

    const unrelatedResponse = await request(app.getHttpServer())
      .get("/api/calendar/events")
      .query(query)
      .set("Cookie", await cookieFor(unrelatedStudent, app))
      .expect(200);

    expect(unrelatedResponse.body.data.events).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: liveTraining.calendarEventId })]),
    );
  });

  it("filters after materials for students until the offline live training is ended", async () => {
    const admin = await createAdmin();
    const student = await createStudent();
    const course = await createTestCourse(admin.id);
    const beforeResource = await createTestResource(admin.id, "Before handout");
    const afterResource = await createTestResource(admin.id, "After handout");
    const startsAt = getFutureDateOnScheduleStep(60);
    const endsAt = getFutureDateOnScheduleStep(120);

    await db.insert(studentCourses).values({
      courseId: course.id,
      studentId: student.id,
      status: COURSE_ENROLLMENT.ENROLLED,
    });

    const createResponse = await request(app.getHttpServer())
      .post("/api/live-training")
      .set("Cookie", await cookieFor(admin, app))
      .send({
        language,
        title: "Materials training",
        startsAt,
        endsAt,
        timezone,
        deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
        linkedCourseIds: [course.id],
        beforeResourceIds: [beforeResource.id],
        afterResourceIds: [afterResource.id],
      })
      .expect(201);
    const liveTraining = createResponse.body.data;

    const beforeEndResponse = await request(app.getHttpServer())
      .get(`/api/live-training/${liveTraining.id}`)
      .query({ language })
      .set("Cookie", await cookieFor(student, app))
      .expect(200);

    expect(beforeEndResponse.body.data.materials.before).toHaveLength(1);
    expect(beforeEndResponse.body.data.materials.after).toHaveLength(0);

    const startResponse = await request(app.getHttpServer())
      .post(`/api/live-training/${liveTraining.id}/sessions/start`)
      .query({ language })
      .set("Cookie", await cookieFor(admin, app))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/live-training/${liveTraining.id}/sessions/${startResponse.body.data.id}/end`)
      .query({ language })
      .set("Cookie", await cookieFor(admin, app))
      .expect(201);

    const afterEndResponse = await request(app.getHttpServer())
      .get(`/api/live-training/${liveTraining.id}`)
      .query({ language })
      .set("Cookie", await cookieFor(student, app))
      .expect(200);

    expect(afterEndResponse.body.data.materials.before).toHaveLength(1);
    expect(afterEndResponse.body.data.materials.after).toHaveLength(1);
  });

  it("ends offline linked live lesson and completes it for enrolled students", async () => {
    const admin = await createAdmin();
    const student = await createStudent();
    const course = await createTestCourse(admin.id);
    const chapter = await chapterFactory.create({ courseId: course.id, authorId: admin.id });
    const startsAt = getFutureDateOnScheduleStep(60);
    const endsAt = getFutureDateOnScheduleStep(120);

    await db.insert(studentCourses).values({
      courseId: course.id,
      studentId: student.id,
      status: COURSE_ENROLLMENT.ENROLLED,
    });

    const lessonResponse = await request(app.getHttpServer())
      .post("/api/lesson/beta-create-lesson/live")
      .set("Cookie", await cookieFor(admin, app))
      .send({
        title: "Course live lesson",
        description: "Course live lesson description",
        chapterId: chapter.id,
        language,
        liveTraining: {
          title: "Course linked training",
          description: "Linked from lesson",
          startsAt,
          endsAt,
          timezone,
          deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
          location: "Room 30",
        },
      })
      .expect(201);

    const lessonId = lessonResponse.body.data.id;
    const { liveTrainingId } = lessonResponse.body.data;

    const startResponse = await request(app.getHttpServer())
      .post(`/api/live-training/${liveTrainingId}/sessions/start`)
      .query({ language })
      .set("Cookie", await cookieFor(admin, app))
      .expect(201);

    expect(startResponse.body.data.status).toBe(LIVE_TRAINING_SESSION_STATUSES.ACTIVE);

    await request(app.getHttpServer())
      .post(`/api/live-training/${liveTrainingId}/sessions/${startResponse.body.data.id}/end`)
      .query({ language })
      .set("Cookie", await cookieFor(admin, app))
      .expect(201);

    const [session] = await db
      .select()
      .from(liveTrainingSessions)
      .where(eq(liveTrainingSessions.id, startResponse.body.data.id));
    const [liveTraining] = await db
      .select()
      .from(liveTrainings)
      .where(eq(liveTrainings.id, liveTrainingId));
    const [liveLesson] = await db
      .select()
      .from(liveLessons)
      .where(
        and(eq(liveLessons.liveTrainingId, liveTrainingId), eq(liveLessons.lessonId, lessonId)),
      );
    const [lessonProgress] = await db
      .select()
      .from(studentLessonProgress)
      .where(
        and(
          eq(studentLessonProgress.studentId, student.id),
          eq(studentLessonProgress.lessonId, lessonId),
        ),
      );

    expect(session.status).toBe(LIVE_TRAINING_SESSION_STATUSES.ENDED);
    expect(liveTraining.status).toBe(LIVE_TRAINING_STATUSES.ENDED);
    expect(liveLesson).toBeDefined();
    expect(lessonProgress.completedAt).not.toBeNull();
    expect(lessonProgress.languageAnswered).toBe(language);
  });
});
