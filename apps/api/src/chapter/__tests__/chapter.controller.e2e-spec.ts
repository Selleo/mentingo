import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, isNull, sql } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES, type LessonTypes } from "src/lesson/lesson.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { chapters, lessons, settings } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { CourseTest } from "../../../test/factory/course.factory";
import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("ChapterController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let admin: UserWithCredentials;
  let adminCookies: string;

  const password = "password123";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    settingsFactory = createSettingsFactory(db);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });
    admin = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    adminCookies = await cookieFor(admin, app);
  });

  afterEach(async () => {
    await truncateTables(baseDb, ["courses", "chapters", "lessons", "users", "settings"]);
  });

  const setPublicCourseAccess = async (enabled: boolean) => {
    await db
      .update(settings)
      .set({
        settings: sql`
          jsonb_set(
            ${settings.settings},
            '{unregisteredUserCoursesAccessibility}',
            to_jsonb(${enabled}),
            true
          )
        `,
      })
      .where(isNull(settings.userId));
  };

  const createChapterWithLessons = async (params: {
    priceInCents: CourseTest["priceInCents"];
    lessonTypes: LessonTypes[];
  }) => {
    const course = await courseFactory.create({
      authorId: admin.id,
      priceInCents: params.priceInCents,
      chapterCount: 1,
    });
    const chapter = await chapterFactory.create({
      authorId: admin.id,
      courseId: course.id,
      lessonCount: params.lessonTypes.length,
    });

    if (params.lessonTypes.length > 0) {
      await db.insert(lessons).values(
        params.lessonTypes.map((type, index) => ({
          chapterId: chapter.id,
          type,
          title: buildJsonbField(SUPPORTED_LANGUAGES.EN, `${type} lesson ${index + 1}`),
          description: buildJsonbField(SUPPORTED_LANGUAGES.EN, ""),
          thresholdScore: type === LESSON_TYPES.QUIZ ? 0 : null,
          displayOrder: index + 1,
        })),
      );
    }

    return chapter;
  };

  const updateFreemiumStatus = (chapterId: UUIDType, isFreemium: boolean) => {
    return request(app.getHttpServer())
      .patch("/api/chapter/freemium-status")
      .query({ chapterId })
      .set("Cookie", adminCookies)
      .send({ isFreemium });
  };

  const getChapterFreemiumStatus = async (chapterId: UUIDType) => {
    const [chapter] = await db
      .select({ isFreemium: chapters.isFreemium })
      .from(chapters)
      .where(eq(chapters.id, chapterId));

    return chapter?.isFreemium;
  };

  describe("PATCH /api/chapter/freemium-status", () => {
    it("allows paid course chapters with content lessons to become freemium", async () => {
      const chapter = await createChapterWithLessons({
        priceInCents: 1200,
        lessonTypes: [LESSON_TYPES.CONTENT],
      });

      await updateFreemiumStatus(chapter.id, true).expect(200);

      await expect(getChapterFreemiumStatus(chapter.id)).resolves.toBe(true);
    });

    it("rejects chapters with non-content lessons", async () => {
      const chapter = await createChapterWithLessons({
        priceInCents: 1200,
        lessonTypes: [LESSON_TYPES.CONTENT, LESSON_TYPES.QUIZ],
      });

      const response = await updateFreemiumStatus(chapter.id, true).expect(400);

      expect(response.body.message).toBe(
        "adminCourseView.curriculum.chapter.errors.freemiumRequiresContentLessons",
      );
      await expect(getChapterFreemiumStatus(chapter.id)).resolves.toBe(false);
    });

    it("allows free course chapters to become public when visitor course access is enabled", async () => {
      await setPublicCourseAccess(true);
      const chapter = await createChapterWithLessons({
        priceInCents: 0,
        lessonTypes: [LESSON_TYPES.CONTENT],
      });

      await updateFreemiumStatus(chapter.id, true).expect(200);

      await expect(getChapterFreemiumStatus(chapter.id)).resolves.toBe(true);
    });

    it("rejects free course chapters when visitor course access is disabled", async () => {
      const chapter = await createChapterWithLessons({
        priceInCents: 0,
        lessonTypes: [LESSON_TYPES.CONTENT],
      });

      const response = await updateFreemiumStatus(chapter.id, true).expect(400);

      expect(response.body.message).toBe(
        "adminCourseView.curriculum.chapter.errors.publicRequiresCourseAccess",
      );
      await expect(getChapterFreemiumStatus(chapter.id)).resolves.toBe(false);
    });

    it("rejects empty chapters", async () => {
      const chapter = await createChapterWithLessons({
        priceInCents: 1200,
        lessonTypes: [],
      });

      const response = await updateFreemiumStatus(chapter.id, true).expect(400);

      expect(response.body.message).toBe(
        "adminCourseView.curriculum.chapter.errors.freemiumRequiresContentLessons",
      );
      await expect(getChapterFreemiumStatus(chapter.id)).resolves.toBe(false);
    });
  });
});
