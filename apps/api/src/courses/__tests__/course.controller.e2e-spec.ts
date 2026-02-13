import { faker } from "@faker-js/faker";
import { COURSE_ENROLLMENT } from "@repo/shared";
import { and, eq, inArray } from "drizzle-orm";
import request from "supertest";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { FileService } from "src/file/file.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { DB, DB_BASE } from "src/storage/db/db.providers";
import {
  courses,
  coursesSummaryStats,
  courseStudentsStats,
  groupCourses,
  lessons,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { CourseTest } from "../../../test/factory/course.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("CourseController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let groupFactory: ReturnType<typeof createGroupFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  const password = "password123";

  beforeAll(async () => {
    // It can be crashed, test and reapir it later
    const mockFileService = {
      getFileUrl: jest.fn().mockResolvedValue("http://example.com/file"),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(""),
      set: jest.fn().mockResolvedValue(""),
    };

    const { app: testApp } = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
      {
        provide: "CACHE_MANAGER",
        useValue: mockCacheManager,
      },
    ]);

    app = testApp;

    db = app.get(DB);
    baseDb = app.get(DB_BASE);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    groupFactory = createGroupFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await truncateTables(baseDb, [
      "courses",
      "chapters",
      "lessons",
      "student_chapter_progress",
      "student_lesson_progress",
      "student_courses",
      "users",
      "categories",
      "settings",
      "group_users",
      "groups",
    ]);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
  });

  describe("GET /api/course/all", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        await request(app.getHttpServer()).get("/api/course/all").expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is admin", () => {
        it("returns 200 and all course list", async () => {
          const category = await categoryFactory.create();
          const author = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          await courseFactory.create({
            authorId: author.id,
            categoryId: category.id,
            status: "published",
            thumbnailS3Key: null,
          });

          const cookies = await cookieFor(author, app);

          const response = await request(app.getHttpServer())
            .get("/api/course/all")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data).toBeDefined();
          expect(response.body.data.length).toBe(1);
        });
      });

      describe("when user is student", () => {
        it("returns 403 for unauthorized request", async () => {
          const category = await categoryFactory.create();
          const author = await userFactory.withAdminRole().create();
          await courseFactory.create({ authorId: author.id, categoryId: category.id });
          const user = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({ role: USER_ROLES.STUDENT });

          await request(app.getHttpServer())
            .get("/api/course/all")
            .set("Cookie", await cookieFor(user, app))
            .expect(403);
        });
      });

      describe("when user is contentCreator", () => {
        it("returns only courses created by the contentCreator", async () => {
          const category = await categoryFactory.create();
          const contentCreator = await userFactory
            .withCredentials({ password })
            .withContentCreatorSettings(db)
            .create({ role: USER_ROLES.CONTENT_CREATOR });
          const otherContentCreator = await userFactory
            .withCredentials({ password })
            .withContentCreatorSettings(db)
            .create({ role: USER_ROLES.CONTENT_CREATOR });

          await courseFactory.create({
            authorId: contentCreator.id,
            categoryId: category.id,
            status: "published",
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            authorId: otherContentCreator.id,
            categoryId: category.id,
            status: "published",
            thumbnailS3Key: null,
          });

          const cookies = await cookieFor(contentCreator, app);
          const response = await request(app.getHttpServer())
            .get("/api/course/all")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data).toBeDefined();
          expect(response.body.data.length).toBe(1);
          expect(response.body.data[0].author).toBe(
            `${contentCreator.firstName} ${contentCreator.lastName}`,
          );
        });
      });

      describe("filtering", () => {
        it("filters by title", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          await courseFactory.create({
            title: "Python Course",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            title: "JavaScript Course",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });

          const response = await request(app.getHttpServer())
            .get("/api/course/all?title=Python")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.length).toBe(1);
          expect(response.body.data[0].title).toContain("Python");
        });

        it("filters by description", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          await courseFactory.create({
            title: "Course One",
            description: "Learn advanced Python programming",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            title: "Course Two",
            description: "Learn JavaScript basics",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });

          const response = await request(app.getHttpServer())
            .get("/api/course/all?description=Python")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.length).toBe(1);
          expect(response.body.data[0].description).toContain("Python");
        });

        it("filters by searchQuery (searches both title and description)", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          await courseFactory.create({
            title: "Python Basics",
            description: "Introduction to programming",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            title: "JavaScript Course",
            description: "Learn Python and JavaScript",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            title: "Ruby Course",
            description: "Learn Ruby on Rails",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });

          const response = await request(app.getHttpServer())
            .get("/api/course/all?searchQuery=Python")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.length).toBe(2);
          expect(
            response.body.data.every(
              (course: CourseTest) =>
                (course.title as string)?.includes("Python") ||
                (course.description as string)?.includes("Python"),
            ),
          ).toBe(true);
        });

        it("filters by date range", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const pastDate = new Date("2023-01-01");
          const futureDate = new Date("2025-01-01");

          await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            createdAt: pastDate.toISOString(),
            thumbnailS3Key: null,
          });

          const response = await request(app.getHttpServer())
            .get(
              `/api/course/all?creationDateRange[0]=${futureDate.toISOString()}&creationDateRange[1]=${futureDate.toISOString()}&creationDateRangeStart=${futureDate.toISOString()}`,
            )
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.length).toBe(0);
        });

        it("filters by status", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();

          await courseFactory.create({
            title: "Published course",
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });
          await courseFactory.create({
            title: "Draft course",
            authorId: admin.id,
            categoryId: category.id,
            status: "draft",
          });
          await courseFactory.create({
            title: "Private course",
            authorId: admin.id,
            categoryId: category.id,
            status: "private",
          });

          const cases = [
            ["published", "Published course"],
            ["draft", "Draft course"],
            ["private", "Private course"],
          ];

          for (const [status, title] of cases) {
            const response = await request(app.getHttpServer())
              .get(`/api/course/all?status=${status}`)
              .set("Cookie", cookies)
              .expect(200);

            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].title).toContain(title);
          }
        });
      });

      describe("pagination", () => {
        it("respects page and perPage parameters", async () => {
          const category = await categoryFactory.create();
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });

          for (let i = 0; i < 15; i++) {
            await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              thumbnailS3Key: null,
            });
          }

          const cookies = await cookieFor(admin, app);
          const response = await request(app.getHttpServer())
            .get("/api/course/all?page=2&perPage=5")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.length).toBe(5);
          expect(response.body.pagination).toEqual({
            totalItems: 15,
            page: 2,
            perPage: 5,
          });
        });
      });

      describe("sorting by -title", () => {
        it("sorts by title descending", async () => {
          const category = await categoryFactory.create();
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .create({ role: USER_ROLES.ADMIN });

          await courseFactory.create({
            title: "Z Course",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });
          await courseFactory.create({
            title: "A Course",
            authorId: admin.id,
            categoryId: category.id,
            thumbnailS3Key: null,
          });

          const cookies = await cookieFor(admin, app);
          const response = await request(app.getHttpServer())
            .get("/api/course/all?sort=-title")
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data[0].title).toBe("Z Course");
          expect(response.body.data[1].title).toBe("A Course");
        });
      });
    });
  });

  describe("GET /api/course/get-student-courses", () => {
    describe("when user is not logged in", () => {
      it("returns 401", async () => {
        await request(app.getHttpServer()).get("/api/course/get-student-courses").expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns only courses enrolled by student", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const enrolledCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values({
          studentId: student.id,
          courseId: enrolledCourse.id,
          finishedChapterCount: 0,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].id).toBe(enrolledCourse.id);
      });

      it("filters by title", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const pythonCourse = await courseFactory.create({
          title: "Python Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const jsCourse = await courseFactory.create({
          title: "JavaScript Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values([
          {
            studentId: student.id,
            courseId: pythonCourse.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: jsCourse.id,
            finishedChapterCount: 0,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses?title=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].title).toBe("Python Course");
      });

      it("filters by description", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const course1 = await courseFactory.create({
          title: "Course One",
          description: "Learn advanced Python programming",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const course2 = await courseFactory.create({
          title: "Course Two",
          description: "Learn JavaScript basics",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values([
          {
            studentId: student.id,
            courseId: course1.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: course2.id,
            finishedChapterCount: 0,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses?description=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].description).toContain("Python");
      });

      it("filters by searchQuery (searches both title and description)", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const course1 = await courseFactory.create({
          title: "Python Basics",
          description: "Introduction to programming",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const course2 = await courseFactory.create({
          title: "JavaScript Course",
          description: "Learn Python and JavaScript",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const course3 = await courseFactory.create({
          title: "Ruby Course",
          description: "Learn Ruby on Rails",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values([
          {
            studentId: student.id,
            courseId: course1.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: course2.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: course3.id,
            finishedChapterCount: 0,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses?searchQuery=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(2);
        expect(
          response.body.data.every(
            (course: CourseTest) =>
              (course.title as string)?.includes("Python") ||
              (course.description as string)?.includes("Python"),
          ),
        ).toBe(true);
      });

      it("returns only published and private courses", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const publishedCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const privateCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "private",
          thumbnailS3Key: null,
        });
        const unpublishedCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "draft",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values([
          {
            studentId: student.id,
            courseId: publishedCourse.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: unpublishedCourse.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: privateCourse.id,
            finishedChapterCount: 0,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(2);
        expect(response.body.data.map((item: CourseTest) => item.id)).toEqual(
          expect.arrayContaining([publishedCourse.id, privateCourse.id]),
        );
      });

      it("sorts by -title", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const courseA = await courseFactory.create({
          title: "A Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const courseZ = await courseFactory.create({
          title: "Z Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values([
          {
            studentId: student.id,
            courseId: courseA.id,
            finishedChapterCount: 0,
          },
          {
            studentId: student.id,
            courseId: courseZ.id,
            finishedChapterCount: 0,
          },
        ]);

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses?sort=-title")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data[0].title).toBe("Z Course");
        expect(response.body.data[1].title).toBe("A Course");
      });

      it("paginates results", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const coursesToCreate = Array.from(
          { length: 15 },
          (_, i) =>
            ({
              title: `Course ${i}`,
              authorId: contentCreator.id,
              categoryId: category.id,
              status: "published",
              thumbnailS3Key: null,
            }) as const,
        );

        const courses = await Promise.all(
          coursesToCreate.map((course) => courseFactory.create(course)),
        );

        await db.insert(studentCourses).values(
          courses.map((course) => ({
            studentId: student.id,
            courseId: course.id,
            finishedChapterCount: 0,
          })),
        );

        const response = await request(app.getHttpServer())
          .get("/api/course/get-student-courses?page=2&perPage=5")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(5);
        expect(response.body.pagination).toEqual({
          totalItems: 15,
          page: 2,
          perPage: 5,
        });
      });
    });
  });

  describe("GET /api/course/:courseId/students", () => {
    describe("when user is not logged in", () => {
      it("should return unauthorized", () => {
        return request(app.getHttpServer()).get("/api/course/1/students").expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is not admin", () => {
        it("should return status 403", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({
              role: USER_ROLES.STUDENT,
            });
          const cookies = await cookieFor(admin, app);

          const response = await request(app.getHttpServer())
            .get(`/api/course/${faker.string.uuid()}/students`)
            .set("Cookie", cookies);

          expect(response.status).toBe(403);
          expect(response.body.message).toBe("Forbidden resource");
        });
      });

      describe("when user is admin", () => {
        it("should return list of students with enrollment date", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) => userFactory.create({ role: USER_ROLES.STUDENT })),
          );

          const course = await courseFactory.create({
            authorId: admin.id,
            status: "published",
          });

          const studentCourse = await db
            .insert(studentCourses)
            .values({
              studentId: students[0].id,
              courseId: course.id,
              finishedChapterCount: 0,
            })
            .returning();

          const response = await request(app.getHttpServer())
            .get(`/api/course/${course.id}/students`)
            .set("Cookie", cookies);

          expect(response.status).toBe(200);
          expect(response.body.data).toEqual([
            {
              firstName: students[0].firstName,
              lastName: students[0].lastName,
              email: students[0].email,
              id: students[0].id,
              enrolledAt: studentCourse[0].enrolledAt,
              groups: [],
              isEnrolledByGroup: false,
            },
            {
              firstName: students[1].firstName,
              lastName: students[1].lastName,
              email: students[1].email,
              id: students[1].id,
              enrolledAt: null,
              groups: [],
              isEnrolledByGroup: false,
            },
          ]);
          expect(response.body.pagination).toEqual({
            totalItems: 2,
            page: 1,
            perPage: DEFAULT_PAGE_SIZE,
          });
        });

        it("should return list filtered by firstName", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) =>
              userFactory.withCredentials({ password }).create(),
            ),
          );

          const course = await courseFactory.create({
            authorId: admin.id,
            status: "published",
          });

          const studentCourse = await db
            .insert(studentCourses)
            .values({
              studentId: students[0].id,
              courseId: course.id,
              finishedChapterCount: 0,
            })
            .returning();

          const response = await request(app.getHttpServer())
            .get(`/api/course/${course.id}/students?keyword=${students[0].firstName}`)
            .set("Cookie", cookies);

          expect(response.status).toBe(200);
          expect(response.body.data).toEqual([
            {
              firstName: students[0].firstName,
              lastName: students[0].lastName,
              email: students[0].email,
              id: students[0].id,
              enrolledAt: studentCourse[0].enrolledAt,
              groups: [],
              isEnrolledByGroup: false,
            },
          ]);
          expect(response.body.pagination).toEqual({
            totalItems: 1,
            page: 1,
            perPage: DEFAULT_PAGE_SIZE,
          });
        });

        it("should return list filtered by lastName", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) =>
              userFactory.withCredentials({ password }).create(),
            ),
          );

          const course = await courseFactory.create({
            authorId: admin.id,
            status: "published",
          });

          const studentCourse = await db
            .insert(studentCourses)
            .values({
              studentId: students[0].id,
              courseId: course.id,
              finishedChapterCount: 0,
            })
            .returning();

          const response = await request(app.getHttpServer())
            .get(`/api/course/${course.id}/students?keyword=${students[0].lastName}`)
            .set("Cookie", cookies);

          expect(response.status).toBe(200);
          expect(response.body.data).toEqual([
            {
              firstName: students[0].firstName,
              lastName: students[0].lastName,
              email: students[0].email,
              id: students[0].id,
              enrolledAt: studentCourse[0].enrolledAt,
              groups: [],
              isEnrolledByGroup: false,
            },
          ]);
          expect(response.body.pagination).toEqual({
            totalItems: 1,
            page: 1,
            perPage: DEFAULT_PAGE_SIZE,
          });
        });

        it("should return list filtered by email", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) =>
              userFactory.withCredentials({ password }).create(),
            ),
          );

          const course = await courseFactory.create({
            authorId: admin.id,
            status: "published",
          });

          const studentCourse = await db
            .insert(studentCourses)
            .values({
              studentId: students[0].id,
              courseId: course.id,
              finishedChapterCount: 0,
            })
            .returning();

          const response = await request(app.getHttpServer())
            .get(`/api/course/${course.id}/students?keyword=${students[0].email}`)
            .set("Cookie", cookies);

          expect(response.status).toBe(200);
          expect(response.body.data).toEqual([
            {
              firstName: students[0].firstName,
              lastName: students[0].lastName,
              email: students[0].email,
              id: students[0].id,
              enrolledAt: studentCourse[0].enrolledAt,
              groups: [],
              isEnrolledByGroup: false,
            },
          ]);
          expect(response.body.pagination).toEqual({
            totalItems: 1,
            page: 1,
            perPage: DEFAULT_PAGE_SIZE,
          });
        });

        it("should return list of students in desc order with enrollment date", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) =>
              userFactory.withCredentials({ password }).create(),
            ),
          );

          const course = await courseFactory.create({
            authorId: admin.id,
            status: "published",
          });

          const studentCourse = await db
            .insert(studentCourses)
            .values({
              studentId: students[0].id,
              courseId: course.id,
              finishedChapterCount: 0,
            })
            .returning();

          const response = await request(app.getHttpServer())
            .get(`/api/course/${course.id}/students?sort=-enrolledAt`)
            .set("Cookie", cookies);

          expect(response.status).toBe(200);
          expect(response.body.data).toEqual([
            {
              firstName: students[1].firstName,
              lastName: students[1].lastName,
              email: students[1].email,
              id: students[1].id,
              enrolledAt: null,
              groups: [],
              isEnrolledByGroup: false,
            },
            {
              firstName: students[0].firstName,
              lastName: students[0].lastName,
              email: students[0].email,
              id: students[0].id,
              enrolledAt: studentCourse[0].enrolledAt,
              groups: [],
              isEnrolledByGroup: false,
            },
          ]);
          expect(response.body.pagination).toEqual({
            totalItems: 2,
            page: 1,
            perPage: DEFAULT_PAGE_SIZE,
          });
        });
      });
    });
  });

  describe("GET /api/course/available-courses", () => {
    describe("when user is not logged in", () => {
      it("returns 200", async () => {
        await request(app.getHttpServer()).get("/api/course/available-courses").expect(200);
      });
    });

    describe("when user is logged in", () => {
      it("returns only published courses that user is not enrolled in", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const enrolledCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const availableCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "draft",
          thumbnailS3Key: null,
        });

        await db.insert(studentCourses).values({
          studentId: student.id,
          courseId: enrolledCourse.id,
          finishedChapterCount: 0,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].id).toBe(availableCourse.id);
      });

      it("filters by title", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        await courseFactory.create({
          title: "Python Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        await courseFactory.create({
          title: "JavaScript Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses?title=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].title).toBe("Python Course");
      });

      it("filters by description", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        await courseFactory.create({
          title: "Course One",
          description: "Learn advanced Python programming",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        await courseFactory.create({
          title: "Course Two",
          description: "Learn JavaScript basics",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses?description=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].description).toContain("Python");
      });

      it("filters by searchQuery (searches both title and description)", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        await courseFactory.create({
          title: "Python Basics",
          description: "Introduction to programming",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        await courseFactory.create({
          title: "JavaScript Course",
          description: "Learn Python and JavaScript",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        await courseFactory.create({
          title: "Ruby Course",
          description: "Learn Ruby on Rails",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses?searchQuery=Python")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(2);
        expect(
          response.body.data.every(
            (course: CourseTest) =>
              (course.title as string)?.includes("Python") ||
              (course.description as string)?.includes("Python"),
          ),
        ).toBe(true);
      });

      it("excludes specified course", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const courseToExclude = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const includedCourse = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get(`/api/course/available-courses?excludeCourseId=${courseToExclude.id}`)
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(1);
        expect(response.body.data[0].id).toBe(includedCourse.id);
      });

      it("includes course chapter count and free chapters info", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const course = await courseFactory.create({
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
          chapterCount: 5,
        });

        await chapterFactory.create({
          courseId: course.id,
          authorId: contentCreator.id,
          title: "Free Chapter",
          isFreemium: true,
          displayOrder: 1,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data[0].courseChapterCount).toBe(5);
        expect(response.body.data[0].hasFreeChapters).toBe(true);
      });

      it("sorts by -title", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        await courseFactory.create({
          title: "A Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        await courseFactory.create({
          title: "Z Course",
          authorId: contentCreator.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses?sort=-title")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data[0].title).toBe("Z Course");
        expect(response.body.data[1].title).toBe("A Course");
      });

      it("paginates results", async () => {
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const cookies = await cookieFor(student, app);
        const category = await categoryFactory.create();
        const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

        const coursesToCreate = Array.from(
          { length: 15 },
          (_, i) =>
            ({
              title: `Course ${i}`,
              authorId: contentCreator.id,
              categoryId: category.id,
              status: "published",
              thumbnailS3Key: null,
            }) as const,
        );

        await Promise.all(coursesToCreate.map((course) => courseFactory.create(course)));

        const response = await request(app.getHttpServer())
          .get("/api/course/available-courses?page=2&perPage=5")
          .set("Cookie", cookies)
          .expect(200);

        expect(response.body.data.length).toBe(5);
        expect(response.body.pagination).toEqual({
          totalItems: 15,
          page: 2,
          perPage: 5,
        });
      });
    });

    it("correctly shows enrolled participant count and pricing", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const cookies = await cookieFor(student, app);
      const category = await categoryFactory.create();
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
        priceInCents: 2999,
        currency: "usd",
      });

      await db.insert(coursesSummaryStats).values({
        courseId: course.id,
        authorId: contentCreator.id,
        freePurchasedCount: 1,
        paidPurchasedCount: 1,
        paidPurchasedAfterFreemiumCount: 1,
        completedFreemiumStudentCount: 2,
        completedCourseStudentCount: 1,
      });

      const response = await request(app.getHttpServer())
        .get("/api/course/available-courses")
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data[0].enrolledParticipantCount).toBe(2);
      expect(response.body.data[0].priceInCents).toBe(2999);
      expect(response.body.data[0].currency).toBe("usd");
    });
  });

  describe("GET /api/course/content-creator-courses", () => {
    it("returns only published courses by specified contentCreator", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const otherContentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      const publishedCourse = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "draft",
        thumbnailS3Key: null,
      });

      await courseFactory.create({
        authorId: otherContentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/course/content-creator-courses?authorId=${contentCreator.id}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(publishedCourse.id);
    });

    it("returns only enrolled courses when scope is ENROLLED", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      const enrolledCourse = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      await db.insert(studentCourses).values({
        studentId: student.id,
        courseId: enrolledCourse.id,
        finishedChapterCount: 0,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/course/content-creator-courses?authorId=${contentCreator.id}&scope=enrolled`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(enrolledCourse.id);
      expect(response.body.data[0].enrolled).toBe(true);
    });

    it("returns available courses when scope is AVAILABLE", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      const availableCourse = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      const enrolledCourse = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      await db.insert(studentCourses).values({
        studentId: student.id,
        courseId: enrolledCourse.id,
        finishedChapterCount: 0,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/course/content-creator-courses?authorId=${contentCreator.id}&scope=available`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(availableCourse.id);
      expect(response.body.data[0].enrolled).toBe(false);
    });

    it("excludes specified course", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      const courseToExclude = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      const courseToInclude = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      const response = await request(app.getHttpServer())
        .get(
          `/api/course/content-creator-courses?authorId=${contentCreator.id}&excludeCourseId=${courseToExclude.id}&scope=available`,
        )
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(courseToInclude.id);
    });

    it("shows contentCreator details correctly", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({
        role: USER_ROLES.CONTENT_CREATOR,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/course/content-creator-courses?authorId=${contentCreator.id}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data[0].author).toBe("John Doe");
      expect(response.body.data[0].authorEmail).toBe("john@example.com");
      expect(response.body.data[0].authorId).toBe(contentCreator.id);
    });

    it("correctly shows course details with free chapters", async () => {
      const student = await userFactory
        .withCredentials({ password })
        .withUserSettings(db)
        .create({ role: USER_ROLES.STUDENT });
      const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
      const category = await categoryFactory.create();
      const cookies = await cookieFor(student, app);

      const course = await courseFactory.create({
        authorId: contentCreator.id,
        categoryId: category.id,
        status: "published",
        thumbnailS3Key: null,
        chapterCount: 3,
        priceInCents: 1999,
        currency: "usd",
      });

      await chapterFactory.create({
        courseId: course.id,
        authorId: contentCreator.id,
        isFreemium: true,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/course/content-creator-courses?authorId=${contentCreator.id}`)
        .set("Cookie", cookies)
        .expect(200);

      expect(response.body.data[0].courseChapterCount).toBe(3);
      expect(response.body.data[0].hasFreeChapters).toBe(true);
      expect(response.body.data[0].priceInCents).toBe(1999);
      expect(response.body.data[0].currency).toBe("usd");
    });
  });

  describe("POST /api/course/:courseId/enroll-courses", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        await request(app.getHttpServer()).post("/api/course/1/enroll-courses").expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is not admin", () => {
        it("should return 403 Forbidden", async () => {
          const user = await userFactory.withCredentials({ password }).withUserSettings(db).create({
            role: USER_ROLES.STUDENT,
          });
          const cookies = await cookieFor(user, app);

          await request(app.getHttpServer())
            .post("/api/course/1/enroll-courses")
            .set("Cookie", cookies)
            .expect(403);
        });
      });

      describe("when user is admin", () => {
        describe("when course is not found", () => {
          it("should return 404", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();
            const cookies = await cookieFor(admin, app);

            await request(app.getHttpServer())
              .post(`/api/course/${faker.string.uuid()}/enroll-courses`)
              .send({ studentIds: [faker.string.uuid()] })
              .set("Cookie", cookies)
              .expect(404);
          });
        });

        describe("when student is already enrolled in course", () => {
          it("should return 409", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();
            const cookies = await cookieFor(admin, app);
            const category = await categoryFactory.create();

            const course = await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              status: "published",
              thumbnailS3Key: null,
            });

            const student1 = await userFactory.withCredentials({ password }).create();
            const student2 = await userFactory.withCredentials({ password }).create();

            await db.insert(studentCourses).values({
              studentId: student1.id,
              courseId: course.id,
            });

            await db.insert(studentCourses).values({
              studentId: student2.id,
              courseId: course.id,
            });

            await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              status: "published",
              thumbnailS3Key: null,
            });

            const result = await request(app.getHttpServer())
              .post(`/api/course/${course.id}/enroll-courses`)
              .send({ studentIds: [student1.id, student2.id] })
              .set("Cookie", cookies);

            expect(result.status).toBe(409);
            const messageIds = result.body.message.match(/[0-9a-f-]{36}/g);
            expect(messageIds).toEqual(expect.arrayContaining([student1.id, student2.id]));
          });
        });

        it("should create enrollments with courses dependencies", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();

          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const chapter = await chapterFactory.create({
            courseId: course.id,
            title: "Free Chapter",
            isFreemium: true,
          });

          await db.insert(lessons).values({
            chapterId: chapter.id,
            type: LESSON_TYPES.QUIZ,
            title: "Quiz",
            thresholdScore: 0,
          });

          const students = await Promise.all(
            Array.from({ length: 2 }, (_, _i) =>
              userFactory.withCredentials({ password }).create(),
            ),
          );
          const studentsIds = students.map((student) => student.id);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-courses`)
            .send({ studentIds: studentsIds })
            .set("Cookie", cookies)
            .expect(201);

          const studentCoursesData = await db
            .select()
            .from(studentCourses)
            .where(eq(studentCourses.courseId, course.id));

          expect(studentCoursesData.length).toBe(2);

          const studentChapterProgressData = await db
            .select()
            .from(studentChapterProgress)
            .where(inArray(studentChapterProgress.studentId, studentsIds));

          expect(studentChapterProgressData.length).toBe(2);

          const studentLessonProgressData = await db
            .select()
            .from(studentLessonProgress)
            .where(inArray(studentLessonProgress.studentId, studentsIds));

          expect(studentLessonProgressData.length).toBe(2);
        });
      });
    });
  });

  describe("POST /api/course/:courseId/enroll-groups-to-course", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        const category = await categoryFactory.create();
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .withAdminRole()
          .create();

        const course = await courseFactory.create({
          authorId: admin.id,
          categoryId: category.id,
        });

        await request(app.getHttpServer())
          .post(`/api/course/${course.id}/enroll-groups-to-course`)
          .send({ groups: [] })
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is student", () => {
        it("returns 403 for unauthorized request", async () => {
          const category = await categoryFactory.create();
          const student = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({ role: USER_ROLES.STUDENT });

          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
          });

          const cookies = await cookieFor(student, app);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({ groups: [] })
            .set("Cookie", cookies)
            .expect(403);
        });
      });

      describe("when user is admin", () => {
        describe("when course does not exist", () => {
          it("returns 404", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();

            const cookies = await cookieFor(admin, app);

            await request(app.getHttpServer())
              .post(`/api/course/${faker.string.uuid()}/enroll-groups-to-course`)
              .send({ groups: [] })
              .set("Cookie", cookies)
              .expect(404);
          });
        });

        it("stores group enrollment data", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const group = await groupFactory.withMembers([]).create();
          const dueDate = new Date("2025-01-15T12:00:00.000Z");

          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({ groups: [{ id: group.id, isMandatory: true, dueDate: dueDate.toISOString() }] })
            .set("Cookie", cookies)
            .expect(201);

          const [groupCourse] = await db
            .select()
            .from(groupCourses)
            .where(and(eq(groupCourses.groupId, group.id), eq(groupCourses.courseId, course.id)));

          expect(groupCourse).toBeDefined();
          expect(groupCourse.isMandatory).toBe(true);
          expect(groupCourse.enrolledBy).toBe(admin.id);
          expect(groupCourse.dueDate?.toISOString()).toBe(dueDate.toISOString());
        });

        it("updates existing group enrollment metadata", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const group = await groupFactory.withMembers([]).create();
          const cookies = await cookieFor(admin, app);
          const initialDueDate = new Date("2025-02-01T08:30:00.000Z");

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({
              groups: [{ id: group.id, isMandatory: true, dueDate: initialDueDate.toISOString() }],
            })
            .set("Cookie", cookies)
            .expect(201);

          const updatedDueDate = new Date("2025-03-02T10:45:00.000Z");

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({
              groups: [{ id: group.id, isMandatory: false, dueDate: updatedDueDate.toISOString() }],
            })
            .set("Cookie", cookies)
            .expect(201);

          const [groupCourse] = await db
            .select()
            .from(groupCourses)
            .where(and(eq(groupCourses.groupId, group.id), eq(groupCourses.courseId, course.id)));

          expect(groupCourse).toBeDefined();
          expect(groupCourse.isMandatory).toBe(false);
          expect(groupCourse.dueDate?.toISOString()).toBe(updatedDueDate.toISOString());
        });

        describe("when group is empty", () => {
          it("should enroll empty group to course successfully", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();

            const category = await categoryFactory.create();
            const course = await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              status: "published",
            });

            // Create chapters and lessons for the course
            const chapter = await chapterFactory.create({
              courseId: course.id,
              title: "Chapter 1",
              isFreemium: true,
            });
            await db.insert(lessons).values({
              chapterId: chapter.id,
              type: LESSON_TYPES.QUIZ,
              title: "Quiz",
              thresholdScore: 0,
            });

            const group = await groupFactory.withMembers([]).create();

            const cookies = await cookieFor(admin, app);

            // Enroll empty group to course
            await request(app.getHttpServer())
              .post(`/api/course/${course.id}/enroll-groups-to-course`)
              .send({ groups: [{ id: group.id, isMandatory: false, dueDate: null }] })
              .set("Cookie", cookies)
              .expect(201);

            // Verify that group is enrolled in the course
            const [groupCourse] = await db
              .select()
              .from(groupCourses)
              .where(and(eq(groupCourses.groupId, group.id), eq(groupCourses.courseId, course.id)));

            expect(groupCourse).toBeDefined();
            expect(groupCourse.groupId).toBe(group.id);
            expect(groupCourse.courseId).toBe(course.id);

            // Create a new user and assign to the group
            const newUser = await userFactory.withCredentials({ password }).create();

            await request(app.getHttpServer())
              .post(`/api/group/set?userId=${newUser.id}`)
              .send([group.id])
              .set("Cookie", cookies)
              .expect(201);

            // Verify that user is automatically enrolled in the course
            const [userEnrollment] = await db
              .select()
              .from(studentCourses)
              .where(
                and(
                  eq(studentCourses.studentId, newUser.id),
                  eq(studentCourses.courseId, course.id),
                ),
              );

            expect(userEnrollment).toBeDefined();
            expect(userEnrollment.enrolledByGroupId).toBe(group.id);
          });
        });

        describe("when group has users", () => {
          it("should enroll new users and link already enrolled users to the group", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();

            const category = await categoryFactory.create();
            const course = await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              status: "published",
            });

            const chapter = await chapterFactory.create({
              courseId: course.id,
              title: "Free Chapter",
              isFreemium: true,
            });

            await db.insert(lessons).values({
              chapterId: chapter.id,
              type: LESSON_TYPES.QUIZ,
              title: "Quiz",
              thresholdScore: 0,
            });

            // Create users
            const student1 = await userFactory.withCredentials({ password }).create();
            const student2 = await userFactory.withCredentials({ password }).create();
            const student3 = await userFactory.withCredentials({ password }).create();

            // Create group with all three users
            const group = await groupFactory
              .withMembers([student1.id, student2.id, student3.id])
              .create();

            // Enroll student1 and student2 individually (enrolledByGroup: false)
            await db.insert(studentCourses).values([
              {
                studentId: student1.id,
                courseId: course.id,
                enrolledByGroupId: null,
              },
              {
                studentId: student2.id,
                courseId: course.id,
                enrolledByGroupId: null,
              },
            ]);

            const cookies = await cookieFor(admin, app);

            // Enroll group to course
            await request(app.getHttpServer())
              .post(`/api/course/${course.id}/enroll-groups-to-course`)
              .send({ groups: [{ id: group.id, isMandatory: false, dueDate: null }] })
              .set("Cookie", cookies)
              .expect(201);

            // Check enrollments
            const enrollments = await db
              .select()
              .from(studentCourses)
              .where(eq(studentCourses.courseId, course.id));

            expect(enrollments.length).toBe(3);

            // student1 should now be linked to the group
            const student1Enrollment = enrollments.find((e) => e.studentId === student1.id);
            expect(student1Enrollment?.enrolledByGroupId).toBe(group.id);

            // student2 should now be linked to the group
            const student2Enrollment = enrollments.find((e) => e.studentId === student2.id);
            expect(student2Enrollment?.enrolledByGroupId).toBe(group.id);

            // student3 should have enrolledByGroupId: group.id (newly enrolled from group)
            const student3Enrollment = enrollments.find((e) => e.studentId === student3.id);
            expect(student3Enrollment?.enrolledByGroupId).toBe(group.id);
          });

          it("should return success when all users are already enrolled", async () => {
            const admin = await userFactory
              .withCredentials({ password })
              .withAdminSettings(db)
              .withAdminRole()
              .create();

            const category = await categoryFactory.create();
            const course = await courseFactory.create({
              authorId: admin.id,
              categoryId: category.id,
              status: "published",
            });

            const chapter = await chapterFactory.create({
              courseId: course.id,
              title: "Free Chapter",
              isFreemium: true,
            });

            await db.insert(lessons).values({
              chapterId: chapter.id,
              type: LESSON_TYPES.QUIZ,
              title: "Quiz",
              thresholdScore: 0,
            });

            // Create users
            const student1 = await userFactory.withCredentials({ password }).create();
            const student2 = await userFactory.withCredentials({ password }).create();

            // Create group with both users
            const group = await groupFactory.withMembers([student1.id, student2.id]).create();

            // Enroll both users individually
            await db.insert(studentCourses).values([
              {
                studentId: student1.id,
                courseId: course.id,
                enrolledByGroupId: null,
              },
              {
                studentId: student2.id,
                courseId: course.id,
                enrolledByGroupId: null,
              },
            ]);

            const cookies = await cookieFor(admin, app);

            // Try to enroll the group (all users are already enrolled)
            await request(app.getHttpServer())
              .post(`/api/course/${course.id}/enroll-groups-to-course`)
              .send({ groups: [{ id: group.id, isMandatory: false, dueDate: null }] })
              .set("Cookie", cookies)
              .expect(201);

            // Check that all users are linked to the group
            const enrollments = await db
              .select()
              .from(studentCourses)
              .where(eq(studentCourses.courseId, course.id));

            expect(enrollments.length).toBe(2);
            enrollments.forEach((e) => {
              expect(e.enrolledByGroupId).toBe(group.id);
            });
          });
        });
      });
    });
  });

  describe("DELETE /api/course/:courseId/unenroll-groups-from-course", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        await request(app.getHttpServer())
          .delete(`/api/course/${faker.string.uuid()}/unenroll-groups-from-course`)
          .send({ groupIds: [] })
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is student", () => {
        it("returns 403 for unauthorized request", async () => {
          const category = await categoryFactory.create();
          const student = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({ role: USER_ROLES.STUDENT });

          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
          });

          const cookies = await cookieFor(student, app);

          await request(app.getHttpServer())
            .delete(`/api/course/${course.id}/unenroll-groups-from-course`)
            .send({ groupIds: [faker.string.uuid()] })
            .set("Cookie", cookies)
            .expect(403);
        });
      });

      describe("when user is admin", () => {
        it("returns 404 when group is not enrolled in the course", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
          });

          const group = await groupFactory.withMembers([]).create();
          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .delete(`/api/course/${course.id}/unenroll-groups-from-course`)
            .send({ groupIds: [group.id] })
            .set("Cookie", cookies)
            .expect(404);
        });

        it("removes group enrollment and unenrolls group members", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const chapter = await chapterFactory.create({
            courseId: course.id,
            title: "Chapter 1",
            isFreemium: true,
          });
          await db.insert(lessons).values({
            chapterId: chapter.id,
            type: LESSON_TYPES.QUIZ,
            title: "Quiz",
            thresholdScore: 0,
          });

          const student = await userFactory.withCredentials({ password }).create();
          const group = await groupFactory.withMembers([student.id]).create();
          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({ groups: [{ id: group.id, isMandatory: false, dueDate: null }] })
            .set("Cookie", cookies)
            .expect(201);

          await request(app.getHttpServer())
            .delete(`/api/course/${course.id}/unenroll-groups-from-course`)
            .send({ groupIds: [group.id] })
            .set("Cookie", cookies)
            .expect(200);

          const groupEnrollments = await db
            .select()
            .from(groupCourses)
            .where(and(eq(groupCourses.groupId, group.id), eq(groupCourses.courseId, course.id)));

          expect(groupEnrollments.length).toBe(0);

          const [studentEnrollment] = await db
            .select()
            .from(studentCourses)
            .where(
              and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)),
            );

          expect(studentEnrollment.status).toBe(COURSE_ENROLLMENT.NOT_ENROLLED);
          expect(studentEnrollment.enrolledByGroupId).toBe(null);
          expect(studentEnrollment.enrolledAt).toBe(null);
        });

        it("keeps students enrolled via other groups", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();

          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const chapter = await chapterFactory.create({
            courseId: course.id,
            title: "Chapter 1",
            isFreemium: true,
          });
          await db.insert(lessons).values({
            chapterId: chapter.id,
            type: LESSON_TYPES.QUIZ,
            title: "Quiz",
            thresholdScore: 0,
          });

          const student = await userFactory.withCredentials({ password }).create();
          const group1 = await groupFactory.withMembers([student.id]).create();
          const group2 = await groupFactory.withMembers([student.id]).create();

          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({ groups: [{ id: group1.id, isMandatory: false, dueDate: null }] })
            .set("Cookie", cookies)
            .expect(201);

          await request(app.getHttpServer())
            .post(`/api/course/${course.id}/enroll-groups-to-course`)
            .send({ groups: [{ id: group2.id, isMandatory: false, dueDate: null }] })
            .set("Cookie", cookies)
            .expect(201);

          const [initialEnrollment] = await db
            .select()
            .from(studentCourses)
            .where(
              and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)),
            );

          expect(initialEnrollment.enrolledByGroupId).toBe(group1.id);

          await request(app.getHttpServer())
            .delete(`/api/course/${course.id}/unenroll-groups-from-course`)
            .send({ groupIds: [group1.id] })
            .set("Cookie", cookies)
            .expect(200);

          const [updatedEnrollment] = await db
            .select()
            .from(studentCourses)
            .where(
              and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)),
            );

          expect(updatedEnrollment.status).toBe(COURSE_ENROLLMENT.ENROLLED);
          expect(updatedEnrollment.enrolledByGroupId).toBe(group2.id);
        });
      });
    });
  });

  describe("DELETE /api/course/unenroll-course", () => {
    it("returns bad request when trying to unenroll a group-enrolled student", async () => {
      const admin = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .withAdminRole()
        .create();

      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: admin.id,
        categoryId: category.id,
        status: "published",
      });

      const chapter = await chapterFactory.create({
        courseId: course.id,
        title: "Chapter 1",
        isFreemium: true,
      });
      await db.insert(lessons).values({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        title: "Quiz",
        thresholdScore: 0,
      });

      const student = await userFactory.withCredentials({ password }).create();
      const group = await groupFactory.withMembers([student.id]).create();

      const cookies = await cookieFor(admin, app);

      await request(app.getHttpServer())
        .post(`/api/course/${course.id}/enroll-courses`)
        .send({ studentIds: [student.id] })
        .set("Cookie", cookies)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/course/${course.id}/enroll-groups-to-course`)
        .send({ groups: [{ id: group.id, isMandatory: false, dueDate: null }] })
        .set("Cookie", cookies)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/course/unenroll-course?courseId=${course.id}&userIds[]=${student.id}`)
        .set("Cookie", cookies)
        .expect(400);

      const [updatedEnrollment] = await db
        .select()
        .from(studentCourses)
        .where(
          and(eq(studentCourses.studentId, student.id), eq(studentCourses.courseId, course.id)),
        );

      expect(updatedEnrollment.status).toBe(COURSE_ENROLLMENT.ENROLLED);
      expect(updatedEnrollment.enrolledByGroupId).toBe(group.id);
    });
  });

  describe("GET /api/course/settings/:courseId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        await request(app.getHttpServer())
          .get(`/api/course/settings/${faker.string.uuid()}`)
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is student", () => {
        it("returns 403 for unauthorized request", async () => {
          const student = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({ role: USER_ROLES.STUDENT });
          const cookies = await cookieFor(student, app);
          const category = await categoryFactory.create();
          const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
          const course = await courseFactory.create({
            authorId: contentCreator.id,
            categoryId: category.id,
            status: "published",
          });

          await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(403);
        });
      });

      describe("when user is admin", () => {
        it("returns course settings with default values", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const response = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data).toBeDefined();
          expect(response.body.data.quizFeedbackEnabled).toBeDefined();
          expect(response.body.data.lessonSequenceEnabled).toBeDefined();
          expect(typeof response.body.data.quizFeedbackEnabled).toBe("boolean");
          expect(typeof response.body.data.lessonSequenceEnabled).toBe("boolean");
        });

        it("returns course settings with custom values", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
            settings: {
              lessonSequenceEnabled: true,
              quizFeedbackEnabled: false,
            },
          });

          const response = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.quizFeedbackEnabled).toBe(false);
          expect(response.body.data.lessonSequenceEnabled).toBe(true);
        });

        it("returns 404 when course does not exist", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .get(`/api/course/settings/${faker.string.uuid()}`)
            .set("Cookie", cookies)
            .expect(404);
        });
      });

      describe("when user is content creator", () => {
        it("returns course settings for own course", async () => {
          const contentCreator = await userFactory
            .withCredentials({ password })
            .withContentCreatorSettings(db)
            .create({ role: USER_ROLES.CONTENT_CREATOR });
          const cookies = await cookieFor(contentCreator, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: contentCreator.id,
            categoryId: category.id,
            status: "published",
          });

          const response = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data).toBeDefined();
          expect(response.body.data.quizFeedbackEnabled).toBeDefined();
          expect(response.body.data.lessonSequenceEnabled).toBeDefined();
        });
      });
    });
  });

  describe("PATCH /api/course/settings/:courseId", () => {
    describe("when user is not logged in", () => {
      it("returns 401 for unauthorized request", async () => {
        await request(app.getHttpServer())
          .patch(`/api/course/settings/${faker.string.uuid()}`)
          .send({ quizFeedbackEnabled: false })
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      describe("when user is student", () => {
        it("returns 403 for unauthorized request", async () => {
          const student = await userFactory
            .withCredentials({ password })
            .withUserSettings(db)
            .create({ role: USER_ROLES.STUDENT });
          const cookies = await cookieFor(student, app);
          const category = await categoryFactory.create();
          const contentCreator = await userFactory.create({ role: USER_ROLES.CONTENT_CREATOR });
          const course = await courseFactory.create({
            authorId: contentCreator.id,
            categoryId: category.id,
            status: "published",
          });

          await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({ quizFeedbackEnabled: false })
            .set("Cookie", cookies)
            .expect(403);
        });
      });

      describe("when user is admin", () => {
        it("updates quizFeedbackEnabled flag to false", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const response = await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({ quizFeedbackEnabled: false })
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.message).toBe("Course lesson settings updated successfully");

          const getResponse = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(getResponse.body.data.quizFeedbackEnabled).toBe(false);
        });

        it("updates quizFeedbackEnabled flag to true", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
            settings: {
              lessonSequenceEnabled: false,
              quizFeedbackEnabled: false,
            },
          });

          const response = await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({ quizFeedbackEnabled: true })
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.message).toBe("Course lesson settings updated successfully");

          const getResponse = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(getResponse.body.data.quizFeedbackEnabled).toBe(true);
        });

        it("updates both quizFeedbackEnabled and lessonSequenceEnabled flags", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
          });

          const response = await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({
              quizFeedbackEnabled: false,
              lessonSequenceEnabled: true,
            })
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.message).toBe("Course lesson settings updated successfully");

          const getResponse = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(getResponse.body.data.quizFeedbackEnabled).toBe(false);
          expect(getResponse.body.data.lessonSequenceEnabled).toBe(true);
        });

        it("preserves existing settings when updating only one flag", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: admin.id,
            categoryId: category.id,
            status: "published",
            settings: {
              lessonSequenceEnabled: true,
              quizFeedbackEnabled: true,
            },
          });

          await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({ quizFeedbackEnabled: false })
            .set("Cookie", cookies)
            .expect(200);

          const getResponse = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(getResponse.body.data.quizFeedbackEnabled).toBe(false);
          expect(getResponse.body.data.lessonSequenceEnabled).toBe(true);
        });

        it("returns 404 when course does not exist", async () => {
          const admin = await userFactory
            .withCredentials({ password })
            .withAdminSettings(db)
            .withAdminRole()
            .create();
          const cookies = await cookieFor(admin, app);

          await request(app.getHttpServer())
            .patch(`/api/course/settings/${faker.string.uuid()}`)
            .send({ quizFeedbackEnabled: false })
            .set("Cookie", cookies)
            .expect(404);
        });
      });

      describe("when user is content creator", () => {
        it("updates course settings for own course", async () => {
          const contentCreator = await userFactory
            .withCredentials({ password })
            .withContentCreatorSettings(db)
            .create({ role: USER_ROLES.CONTENT_CREATOR });
          const cookies = await cookieFor(contentCreator, app);
          const category = await categoryFactory.create();
          const course = await courseFactory.create({
            authorId: contentCreator.id,
            categoryId: category.id,
            status: "published",
          });

          const response = await request(app.getHttpServer())
            .patch(`/api/course/settings/${course.id}`)
            .send({ quizFeedbackEnabled: false })
            .set("Cookie", cookies)
            .expect(200);

          expect(response.body.data.message).toBe("Course lesson settings updated successfully");

          const getResponse = await request(app.getHttpServer())
            .get(`/api/course/settings/${course.id}`)
            .set("Cookie", cookies)
            .expect(200);

          expect(getResponse.body.data.quizFeedbackEnabled).toBe(false);
        });
      });
    });
  });

  describe("GET /api/course/course-ownership/:courseId", () => {
    describe("when user is not logged in", () => {
      it("returns 401", async () => {
        await request(app.getHttpServer())
          .get(`/api/course/course-ownership/${faker.string.uuid()}`)
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("returns current author and candidate list for admin", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const author = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({
            role: USER_ROLES.CONTENT_CREATOR,
            firstName: "Alice",
            lastName: "Author",
            email: "alice@example.com",
          });
        const candidate = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({
            role: USER_ROLES.CONTENT_CREATOR,
            firstName: "Bob",
            lastName: "Candidate",
            email: "bob@example.com",
          });
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          authorId: author.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        const response = await request(app.getHttpServer())
          .get(`/api/course/course-ownership/${course.id}`)
          .set("Cookie", await cookieFor(admin, app))
          .expect(200);

        expect(response.body.data.currentAuthor).toEqual({
          id: author.id,
          name: "Alice Author",
          email: "alice@example.com",
        });
        expect(response.body.data.possibleCandidates).toEqual(
          expect.arrayContaining([expect.objectContaining({ id: candidate.id })]),
        );
        expect(
          response.body.data.possibleCandidates.every(
            (ownership: { id: string }) => ownership.id !== author.id,
          ),
        ).toBe(true);
      });

      it("returns 403 for content creator without access", async () => {
        const contentCreator = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const author = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          authorId: author.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await request(app.getHttpServer())
          .get(`/api/course/course-ownership/${course.id}`)
          .set("Cookie", await cookieFor(contentCreator, app))
          .expect(403);
      });
    });
  });

  describe("POST /api/course/course-ownership/transfer", () => {
    describe("when user is not logged in", () => {
      it("returns 401", async () => {
        await request(app.getHttpServer())
          .post("/api/course/course-ownership/transfer")
          .send({ courseId: faker.string.uuid(), userId: faker.string.uuid() })
          .expect(401);
      });
    });

    describe("when user is logged in", () => {
      it("transfers ownership and updates stats for admin", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const author = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const newOwner = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const otherAuthor = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });

        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          authorId: author.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });
        const otherCourse = await courseFactory.create({
          authorId: otherAuthor.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await db.insert(coursesSummaryStats).values([
          { courseId: course.id, authorId: author.id },
          { courseId: otherCourse.id, authorId: otherAuthor.id },
        ]);
        await db.insert(courseStudentsStats).values([
          { courseId: course.id, authorId: author.id, month: 1, year: 2025 },
          { courseId: otherCourse.id, authorId: otherAuthor.id, month: 1, year: 2025 },
        ]);

        await request(app.getHttpServer())
          .post("/api/course/course-ownership/transfer")
          .send({ courseId: course.id, userId: newOwner.id })
          .set("Cookie", await cookieFor(admin, app))
          .expect(201);

        const [updatedCourse] = await db.select().from(courses).where(eq(courses.id, course.id));
        const [untouchedCourse] = await db
          .select()
          .from(courses)
          .where(eq(courses.id, otherCourse.id));
        expect(updatedCourse.authorId).toBe(newOwner.id);
        expect(untouchedCourse.authorId).toBe(otherAuthor.id);

        const [updatedSummary] = await db
          .select()
          .from(coursesSummaryStats)
          .where(eq(coursesSummaryStats.courseId, course.id));
        const [untouchedSummary] = await db
          .select()
          .from(coursesSummaryStats)
          .where(eq(coursesSummaryStats.courseId, otherCourse.id));
        expect(updatedSummary.authorId).toBe(newOwner.id);
        expect(untouchedSummary.authorId).toBe(otherAuthor.id);

        const [updatedStudentStats] = await db
          .select()
          .from(courseStudentsStats)
          .where(eq(courseStudentsStats.courseId, course.id));
        const [untouchedStudentStats] = await db
          .select()
          .from(courseStudentsStats)
          .where(eq(courseStudentsStats.courseId, otherCourse.id));
        expect(updatedStudentStats.authorId).toBe(newOwner.id);
        expect(untouchedStudentStats.authorId).toBe(otherAuthor.id);
      });

      it("returns 400 when candidate is not available", async () => {
        const admin = await userFactory
          .withCredentials({ password })
          .withAdminSettings(db)
          .create({ role: USER_ROLES.ADMIN });
        const author = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const student = await userFactory
          .withCredentials({ password })
          .withUserSettings(db)
          .create({ role: USER_ROLES.STUDENT });
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          authorId: author.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await request(app.getHttpServer())
          .post("/api/course/course-ownership/transfer")
          .send({ courseId: course.id, userId: student.id })
          .set("Cookie", await cookieFor(admin, app))
          .expect(400);
      });

      it("returns 403 for content creator without access", async () => {
        const contentCreator = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const author = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const newOwner = await userFactory
          .withCredentials({ password })
          .withContentCreatorSettings(db)
          .create({ role: USER_ROLES.CONTENT_CREATOR });
        const category = await categoryFactory.create();
        const course = await courseFactory.create({
          authorId: author.id,
          categoryId: category.id,
          status: "published",
          thumbnailS3Key: null,
        });

        await request(app.getHttpServer())
          .post("/api/course/course-ownership/transfer")
          .send({ courseId: course.id, userId: newOwner.id })
          .set("Cookie", await cookieFor(contentCreator, app))
          .expect(403);
      });
    });
  });

  describe("GET /api/course/lookup (slug functionality)", () => {
    it("returns found status when accessing course by UUID", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      const response = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(response.body.data.status).toBe("found");
      expect(response.body.data.slug).toBeDefined();
    });

    it("generates shortId and slug on first lookup when course has no shortId", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      const [courseBeforeLookup] = await db
        .select({ shortId: courses.shortId })
        .from(courses)
        .where(eq(courses.id, course.id));
      expect(courseBeforeLookup.shortId).toBeNull();

      const response = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(response.body.data.slug).toBeDefined();
      expect(response.body.data.slug).not.toBe(course.id);

      const [courseAfterLookup] = await db
        .select({ shortId: courses.shortId })
        .from(courses)
        .where(eq(courses.id, course.id));
      expect(courseAfterLookup.shortId).toBeDefined();
      expect(courseAfterLookup.shortId).toHaveLength(5);
    });

    it("returns found status when accessing with correct slug", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      const firstResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      const correctSlug = firstResponse.body.data.slug;

      const secondResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: correctSlug, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(secondResponse.body.data.status).toBe("found");
      expect(secondResponse.body.data.slug).toBe(correctSlug);
    });

    it("returns redirect status when accessing with invalid slug text but valid shortId", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      const firstResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      const correctSlug = firstResponse.body.data.slug;
      const shortId = correctSlug.substring(0, 5);
      const invalidSlug = `${shortId}-some-wrong-slug-text`;

      const secondResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: invalidSlug, language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(secondResponse.body.data.status).toBe("redirect");
      expect(secondResponse.body.data.slug).toBe(correctSlug);
    });

    it("returns not found for non-existent shortId", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });

      await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: "zzzzz-non-existent-slug", language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(404);
    });

    it("returns not found for invalid slug format", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });

      await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: "invalid-slug-format", language: "en" })
        .set("Cookie", await cookieFor(author, app))
        .expect(404);
    });

    it("handles lookup in language without title (returns courseId as fallback slug)", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      await db
        .update(courses)
        .set({ availableLocales: ["en", "pl"] })
        .where(eq(courses.id, course.id));

      const response = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "pl" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(response.body.data.status).toBe("found");
      expect(response.body.data.slug).toBeDefined();
    });

    it("handles lookup after adding title in new language", async () => {
      const author = await userFactory
        .withCredentials({ password })
        .withAdminSettings(db)
        .create({ role: USER_ROLES.ADMIN });
      const category = await categoryFactory.create();
      const course = await courseFactory.create({
        authorId: author.id,
        categoryId: category.id,
        status: "published",
      });

      await db
        .update(courses)
        .set({ availableLocales: ["en", "pl"] })
        .where(eq(courses.id, course.id));

      const firstResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "pl" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(firstResponse.body.data.status).toBe("found");
      expect(firstResponse.body.data.slug).toBeDefined();

      await db
        .update(courses)
        .set({
          title: { en: course.title as string, pl: "Polski tytuł kursu" },
        })
        .where(eq(courses.id, course.id));

      const secondResponse = await request(app.getHttpServer())
        .get("/api/course/lookup")
        .query({ id: course.id, language: "pl" })
        .set("Cookie", await cookieFor(author, app))
        .expect(200);

      expect(secondResponse.body.data.status).toBe("found");
      expect(secondResponse.body.data.slug).toBeDefined();

      const [courseAfter] = await db
        .select({ shortId: courses.shortId })
        .from(courses)
        .where(eq(courses.id, course.id));
      expect(courseAfter.shortId).toHaveLength(5);
    });
  });
});
