import { COURSE_ENROLLMENT, LEARNING_PATH_ENROLLMENT_TYPES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import {
  EnrollUserToGroupEvent,
  LearningPathCourseAddedEvent,
  LearningPathCourseRemovedEvent,
  LearningPathCourseSyncEvent,
  UserCourseFinishedEvent,
} from "src/events";
import { LearningPathCourseSyncHandler } from "src/learning-path/handlers/learning-path-course-sync.handler";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  groupUsers,
  studentCourses,
  studentLearningPathCourses,
  studentLearningPaths,
} from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLearningPathFactory } from "../../../test/factory/learningPath.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

const TABLES_TO_TRUNCATE: Parameters<typeof truncateTables>[1] = [
  "student_learning_path_courses",
  "student_learning_paths",
  "student_courses",
  "group_courses",
  "group_learning_paths",
  "learning_path_courses",
  "learning_paths",
  "courses",
  "categories",
  "group_users",
  "groups",
  "users",
  "settings",
];

describe("LearningPathCourseSyncHandler (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let learningPathFactory: ReturnType<typeof createLearningPathFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const testPassword = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    groupFactory = createGroupFactory(db);
    learningPathFactory = createLearningPathFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(baseDb, TABLES_TO_TRUNCATE);
    await settingsFactory.create({ userId: null });
  });

  it("enrolls path members when a course is added to the path", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({
      authorId: adminUser.id,
      status: "published",
      thumbnailS3Key: null,
    });

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [course.id] })
      .expect(201);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseAddedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    const [studentCourseEnrollment] = await baseDb
      .select({
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)));

    const [studentPathCourse] = await baseDb
      .select({
        studentId: studentLearningPathCourses.studentId,
        learningPathId: studentLearningPathCourses.learningPathId,
        courseId: studentLearningPathCourses.courseId,
      })
      .from(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.studentId, student.id),
          eq(studentLearningPathCourses.learningPathId, learningPath.id),
          eq(studentLearningPathCourses.courseId, course.id),
        ),
      );

    expect(studentCourseEnrollment).toEqual({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledByGroupId: null,
    });
    expect(studentPathCourse).toEqual({
      studentId: student.id,
      learningPathId: learningPath.id,
      courseId: course.id,
    });
  });

  it("keeps group-granted course access when a path course is removed", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const group = await groupFactory.withMembers([student.id]).create();
    const course = await courseFactory.create({
      authorId: adminUser.id,
      status: "published",
      thumbnailS3Key: null,
    });

    await request(app.getHttpServer())
      .post(`/api/course/${course.id}/enroll-groups-to-course`)
      .set("Cookie", adminCookies)
      .send({ groups: [{ id: group.id, isMandatory: true }] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [course.id] })
      .expect(201);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseAddedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}/courses/${course.id}`)
      .set("Cookie", adminCookies)
      .expect(200);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseRemovedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    const [studentCourseEnrollment] = await baseDb
      .select({
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)));

    const studentPathCourse = await baseDb.query.studentLearningPathCourses.findFirst({
      where: and(
        eq(studentLearningPathCourses.studentId, student.id),
        eq(studentLearningPathCourses.learningPathId, learningPath.id),
        eq(studentLearningPathCourses.courseId, course.id),
      ),
    });

    expect(studentCourseEnrollment).toEqual({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledByGroupId: group.id,
    });
    expect(studentPathCourse).toBeUndefined();
  });

  it("keeps direct course access when a course is removed from a learning path", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({
      authorId: adminUser.id,
      status: "published",
      thumbnailS3Key: null,
    });

    await baseDb
      .update(studentCourses)
      .set({
        enrolledAt: new Date(Date.now() + 60_000).toISOString(),
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId: null,
      })
      .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)));

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [course.id] })
      .expect(201);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseAddedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}/courses/${course.id}`)
      .set("Cookie", adminCookies)
      .expect(200);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseRemovedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    const [studentCourseEnrollment] = await baseDb
      .select({
        studentId: studentCourses.studentId,
        courseId: studentCourses.courseId,
        status: studentCourses.status,
        enrolledByGroupId: studentCourses.enrolledByGroupId,
      })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)));

    const studentPathCourse = await baseDb.query.studentLearningPathCourses.findFirst({
      where: and(
        eq(studentLearningPathCourses.studentId, student.id),
        eq(studentLearningPathCourses.learningPathId, learningPath.id),
        eq(studentLearningPathCourses.courseId, course.id),
      ),
    });

    expect(studentCourseEnrollment).toEqual({
      studentId: student.id,
      courseId: course.id,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledByGroupId: null,
    });
    expect(studentPathCourse).toBeUndefined();
  });

  it("keeps later direct course access when a course is removed from a learning path", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const course = await courseFactory.create({
      authorId: adminUser.id,
      status: "published",
      thumbnailS3Key: null,
    });

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [course.id] })
      .expect(201);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseAddedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    await baseDb
      .update(studentCourses)
      .set({
        enrolledAt: new Date(Date.now() + 60_000).toISOString(),
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledByGroupId: null,
      })
      .where(and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)));

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}/courses/${course.id}`)
      .set("Cookie", adminCookies)
      .expect(200);

    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseRemovedEvent({
        tenantId: adminUser.tenantId,
        learningPathId: learningPath.id,
        courseId: course.id,
      }),
    );

    await expectStudentCourseStatus(student.id, course.id, COURSE_ENROLLMENT.ENROLLED);
  });

  it("blocks later sequenced courses until the previous course is completed", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({
      authorId: adminUser.id,
      sequenceEnabled: true,
    });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);

    await completeStudentCourse(student.id, firstCourse.id);

    await app.get(LearningPathCourseSyncHandler).handle(
      new UserCourseFinishedEvent({
        userId: student.id,
        courseId: firstCourse.id,
        actor: {
          userId: adminUser.id,
          email: adminUser.email,
          roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
          permissions: [],
          tenantId: adminUser.tenantId,
        },
      }),
    );

    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);

    const [studentPath] = await baseDb
      .select({
        progress: studentLearningPaths.progress,
        completedAt: studentLearningPaths.completedAt,
      })
      .from(studentLearningPaths)
      .where(
        and(
          eq(studentLearningPaths.studentId, student.id),
          eq(studentLearningPaths.learningPathId, learningPath.id),
        ),
      );

    expect(studentPath).toEqual({
      progress: PROGRESS_STATUSES.IN_PROGRESS,
      completedAt: null,
    });
  });

  it("re-syncs existing course access when sequencing is enabled", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({
      authorId: adminUser.id,
      sequenceEnabled: false,
    });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);

    await request(app.getHttpServer())
      .patch(`/api/learning-path/${learningPath.id}`)
      .set("Cookie", adminCookies)
      .send({ sequenceEnabled: true })
      .expect(200);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
  });

  it("re-syncs stale course access after sequenced courses are reordered", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({
      authorId: adminUser.id,
      sequenceEnabled: true,
    });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);
    const thirdCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id, thirdCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);
    await completeStudentCourse(student.id, firstCourse.id);

    await app.get(LearningPathCourseSyncHandler).handle(
      new UserCourseFinishedEvent({
        userId: student.id,
        courseId: firstCourse.id,
        actor: {
          userId: adminUser.id,
          email: adminUser.email,
          roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
          permissions: [],
          tenantId: adminUser.tenantId,
        },
      }),
    );

    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, thirdCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);

    await request(app.getHttpServer())
      .patch(`/api/learning-path/${learningPath.id}/courses/reorder`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [thirdCourse.id, firstCourse.id, secondCourse.id] })
      .expect(200);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, thirdCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
  });

  it("removes path-granted course access when a direct learning path enrollment is removed", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(200);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
  });

  it("removes path-granted course access when a group learning path enrollment is removed", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const group = await groupFactory.withMembers([student.id]).create();
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
      .set("Cookie", adminCookies)
      .send({ groupIds: [group.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}/enroll-groups`)
      .set("Cookie", adminCookies)
      .send({ groupIds: [group.id] })
      .expect(200);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
  });

  it("removes path-granted course access when a learning path is deleted", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-users`)
      .set("Cookie", adminCookies)
      .send({ studentIds: [student.id] })
      .expect(201);

    await handleSync(adminUser.tenantId, learningPath.id);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);

    await request(app.getHttpServer())
      .delete(`/api/learning-path/${learningPath.id}`)
      .set("Cookie", adminCookies)
      .expect(200);

    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.NOT_ENROLLED);
  });

  it("enrolls future group members to group learning paths", async () => {
    const adminUser = await createAdminUser();
    const adminCookies = await cookieFor(adminUser, app);
    const learningPath = await learningPathFactory.create({ authorId: adminUser.id });
    const student = await userFactory.create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const group = await groupFactory.create();
    const firstCourse = await createPublishedCourse(adminUser.id);
    const secondCourse = await createPublishedCourse(adminUser.id);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/courses`)
      .set("Cookie", adminCookies)
      .send({ courseIds: [firstCourse.id, secondCourse.id] })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/learning-path/${learningPath.id}/enroll-groups`)
      .set("Cookie", adminCookies)
      .send({ groupIds: [group.id] })
      .expect(201);

    await baseDb.insert(groupUsers).values({
      groupId: group.id,
      userId: student.id,
      tenantId: adminUser.tenantId,
    });

    await app.get(LearningPathCourseSyncHandler).handle(
      new EnrollUserToGroupEvent({
        groupId: group.id,
        userId: student.id,
        actor: buildActor(adminUser),
      }),
    );

    const [studentPath] = await baseDb
      .select({
        studentId: studentLearningPaths.studentId,
        learningPathId: studentLearningPaths.learningPathId,
        enrollmentType: studentLearningPaths.enrollmentType,
      })
      .from(studentLearningPaths)
      .where(
        and(
          eq(studentLearningPaths.studentId, student.id),
          eq(studentLearningPaths.learningPathId, learningPath.id),
        ),
      );

    const pathCourseLinks = await baseDb
      .select()
      .from(studentLearningPathCourses)
      .where(
        and(
          eq(studentLearningPathCourses.studentId, student.id),
          eq(studentLearningPathCourses.learningPathId, learningPath.id),
        ),
      );

    expect(studentPath).toEqual({
      studentId: student.id,
      learningPathId: learningPath.id,
      enrollmentType: LEARNING_PATH_ENROLLMENT_TYPES.GROUP,
    });
    expect(pathCourseLinks).toHaveLength(2);
    await expectStudentCourseStatus(student.id, firstCourse.id, COURSE_ENROLLMENT.ENROLLED);
    await expectStudentCourseStatus(student.id, secondCourse.id, COURSE_ENROLLMENT.ENROLLED);
  });

  async function createAdminUser(): Promise<UserWithCredentials> {
    return userFactory
      .withCredentials({ password: testPassword })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
  }

  async function createPublishedCourse(authorId: string) {
    return courseFactory.create({
      authorId,
      status: "published",
      thumbnailS3Key: null,
    });
  }

  async function handleSync(tenantId: string, learningPathId: string) {
    await app.get(LearningPathCourseSyncHandler).handle(
      new LearningPathCourseSyncEvent({
        tenantId,
        learningPathId,
      }),
    );
  }

  function buildActor(adminUser: UserWithCredentials) {
    return {
      userId: adminUser.id,
      email: adminUser.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: [],
      tenantId: adminUser.tenantId,
    };
  }

  async function completeStudentCourse(studentId: string, courseId: string) {
    await baseDb
      .update(studentCourses)
      .set({
        progress: PROGRESS_STATUSES.COMPLETED,
        completedAt: new Date().toISOString(),
      })
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));
  }

  async function expectStudentCourseStatus(
    studentId: string,
    courseId: string,
    expectedStatus: string | undefined,
  ) {
    const [studentCourse] = await baseDb
      .select({ status: studentCourses.status })
      .from(studentCourses)
      .where(and(eq(studentCourses.studentId, studentId), eq(studentCourses.courseId, courseId)));

    expect(studentCourse?.status).toBe(expectedStatus);
  }
});
