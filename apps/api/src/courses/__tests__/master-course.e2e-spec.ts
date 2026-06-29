import { Readable } from "stream";

import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { BunnyStreamService } from "src/bunny/bunnyStream.service";
import { buildJsonbField, buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { MasterCourseService } from "src/courses/master-course.service";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { QUESTION_TYPE } from "src/questions/schema/question.types";
import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  categories,
  chapters,
  courses,
  lessons,
  masterCourseExports,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
  tenants,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_TEST_TENANT_HOST } from "../../../test/helpers/tenant-helpers";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { UserWithCredentials } from "test/factory/user.factory";

const SOURCE_HOST = DEFAULT_TEST_TENANT_HOST;
const TARGET_HOST = "https://tenant-2.local";
const PASSWORD = "Password123@";

type ExportSetup = {
  sourceAdmin: UserWithCredentials;
  targetAdmin: UserWithCredentials;
  sourceCourseId: string;
  sourceChapterId: string;
  sourceLessonId: string;
};

const withTenantHost = (req: request.Test, host: string) =>
  req.set("Referer", host.endsWith("/") ? host : `${host}/`);
const ensureCookieArray = (cookies: string | string[]) => {
  const normalizedCookies = (Array.isArray(cookies) ? cookies : [cookies]).map(
    (cookie) => cookie.split(";")[0],
  );
  const accessTokenCookie = normalizedCookies.find((cookie) => cookie.startsWith("access_token="));
  return accessTokenCookie ? [accessTokenCookie] : normalizedCookies;
};

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor<T>(
  fetcher: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 15000,
  intervalMs = 250,
): Promise<T> {
  const start = Date.now();
  let lastValue = await fetcher();

  while (!predicate(lastValue)) {
    if (Date.now() - start >= timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }

    await sleep(intervalMs);
    lastValue = await fetcher();
  }

  return lastValue;
}

describe("Master course export and sync (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let runAsTenant: <T>(tenantId: string, fn: () => Promise<T>) => Promise<T>;
  let sourceTenantId: string;
  let targetTenantId: string;
  let masterCourseService: MasterCourseService;
  let mockS3Service: {
    copyFile: jest.Mock;
    getFileExists: jest.Mock;
    getFileStream: jest.Mock;
    isConfigured: jest.Mock;
    uploadStreamMultipart: jest.Mock;
  };
  let mockBunnyStreamService: {
    downloadMp4Fallback: jest.Mock;
    getMediaConfigurationSignature: jest.Mock;
    isConfigured: jest.Mock;
    uploadStream: jest.Mock;
  };

  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  beforeAll(async () => {
    const mockFileService = {
      getFileUrl: jest.fn().mockResolvedValue("http://example.com/file"),
      isBunnyConfigured: jest.fn().mockResolvedValue(false),
      uploadFile: jest.fn(),
      deleteFileByPath: jest.fn(),
    };
    mockS3Service = {
      copyFile: jest.fn().mockResolvedValue(undefined),
      getFileExists: jest.fn().mockImplementation(async (key: string) => {
        if (key.includes("/master-course/")) return false;
        return true;
      }),
      getFileStream: jest.fn().mockResolvedValue({
        stream: Readable.from(Buffer.from("source-video")),
        contentType: "video/mp4",
      }),
      isConfigured: jest.fn().mockReturnValue(true),
      uploadStreamMultipart: jest.fn().mockResolvedValue(undefined),
    };
    mockBunnyStreamService = {
      downloadMp4Fallback: jest.fn().mockResolvedValue({
        stream: Readable.from(Buffer.from("bunny-video")),
        contentType: "video/mp4",
        filename: "play_720p.mp4",
        resolution: 720,
      }),
      getMediaConfigurationSignature: jest.fn().mockResolvedValue("source-target-same"),
      isConfigured: jest.fn().mockResolvedValue(false),
      uploadStream: jest.fn().mockResolvedValue({
        fileKey: "bunny-target-upload",
        bunnyGuid: "target-upload",
      }),
    };

    const mockCacheManager = {
      get: jest.fn().mockResolvedValue(""),
      set: jest.fn().mockResolvedValue(""),
    };

    const e2e = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
      {
        provide: S3Service,
        useValue: mockS3Service,
      },
      {
        provide: BunnyStreamService,
        useValue: mockBunnyStreamService,
      },
      {
        provide: "CACHE_MANAGER",
        useValue: mockCacheManager,
      },
    ]);

    app = e2e.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    masterCourseService = app.get(MasterCourseService);
    runAsTenant = e2e.runAsTenant;
    sourceTenantId = e2e.defaultTenantId;

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);

    await baseDb
      .update(tenants)
      .set({
        name: "Source Managing Tenant",
        host: SOURCE_HOST,
        isManaging: true,
      })
      .where(eq(tenants.id, sourceTenantId));

    const [existingTargetTenant] = await baseDb
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, TARGET_HOST))
      .limit(1);

    if (existingTargetTenant) {
      targetTenantId = existingTargetTenant.id;
      await baseDb
        .update(tenants)
        .set({ isManaging: false, name: "Target Tenant" })
        .where(eq(tenants.id, targetTenantId));
    } else {
      const [createdTargetTenant] = await baseDb
        .insert(tenants)
        .values({
          name: "Target Tenant",
          host: TARGET_HOST,
          isManaging: false,
        })
        .returning({ id: tenants.id });

      targetTenantId = createdTargetTenant.id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const truncateMasterCourseTables = async () => {
    await truncateTables(baseDb, [
      "master_course_entity_map",
      "master_course_exports",
      "resource_entity",
      "resources",
      "question_answer_options",
      "questions",
      "ai_mentor_lessons",
      "lessons",
      "chapters",
      "courses_summary_stats",
      "courses",
      "categories",
      "credentials",
      "user_onboarding",
      "users",
      "settings",
    ]);
  };

  beforeEach(async () => {
    await truncateMasterCourseTables();
    jest.clearAllMocks();
    mockS3Service.getFileExists.mockImplementation(async (key: string) => {
      if (key.includes("/master-course/")) return false;
      return true;
    });
    mockS3Service.isConfigured.mockReturnValue(true);
    mockBunnyStreamService.isConfigured.mockResolvedValue(false);
    mockBunnyStreamService.getMediaConfigurationSignature.mockResolvedValue("source-target-same");

    await runAsTenant(sourceTenantId, async () => {
      await settingsFactory.create({ userId: null });
    });

    await runAsTenant(targetTenantId, async () => {
      await settingsFactory.create({ userId: null });
    });
  });

  afterEach(async () => {
    await truncateMasterCourseTables();
  });

  const setupAndExport = async (options?: {
    createMatchingTargetCategory?: boolean;
    beforeExport?: (setup: ExportSetup) => Promise<void>;
  }): Promise<
    ExportSetup & {
      sourceCookie: string[];
      targetCookie: string[];
      targetCourseId: string;
      targetCategoryId?: string;
    }
  > => {
    const sourceAdmin = await runAsTenant(sourceTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+source-${faker.string.alphanumeric(8)}@example.com`,
          role: SYSTEM_ROLE_SLUGS.ADMIN,
          tenantId: sourceTenantId,
        }),
    );

    const targetAdmin = await runAsTenant(targetTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+target-${faker.string.alphanumeric(8)}@example.com`,
          role: SYSTEM_ROLE_SLUGS.ADMIN,
          tenantId: targetTenantId,
        }),
    );

    const categoryTitle = `Export category ${faker.string.nanoid(8)}`;

    const sourceData = await runAsTenant(sourceTenantId, async () => {
      const category = await categoryFactory.create({ title: categoryTitle });
      await db
        .update(categories)
        .set({
          title: buildJsonbFieldWithMultipleEntries({
            en: categoryTitle,
            pl: "Kategoria eksportu",
          }),
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        })
        .where(eq(categories.id, category.id));

      const sourceCourse = await courseFactory.create({
        title: "Master Source Course",
        description: "Master Source Description",
        status: "published",
        authorId: sourceAdmin.id,
        categoryId: category.id,
        chapterCount: 1,
        priceInCents: 4999,
        currency: "eur",
        stripeProductId: "prod_master_source",
        stripePriceId: "price_master_source",
      });

      await db
        .update(courses)
        .set({
          title: buildJsonbFieldWithMultipleEntries({
            en: "Master Source Course",
            pl: "Kurs zrodlowy master",
          }),
          description: buildJsonbFieldWithMultipleEntries({
            en: "Master Source Description",
            pl: "Opis kursu zrodlowego master",
          }),
          availableLocales: ["en", "pl"],
        })
        .where(eq(courses.id, sourceCourse.id));

      const sourceChapter = await chapterFactory.create({
        title: "Master Source Chapter",
        courseId: sourceCourse.id,
        authorId: sourceAdmin.id,
        displayOrder: 7,
        isFreemium: true,
        lessonCount: 1,
      });

      await db
        .update(chapters)
        .set({
          title: buildJsonbFieldWithMultipleEntries({
            en: "Master Source Chapter",
            pl: "Rozdzial zrodlowy master",
          }),
        })
        .where(eq(chapters.id, sourceChapter.id));

      const [sourceLesson] = await db
        .insert(lessons)
        .values({
          id: faker.string.uuid(),
          chapterId: sourceChapter.id,
          type: "content",
          title: buildJsonbField("en", "Master Source Lesson"),
          description: buildJsonbField("en", "Master Source Lesson Description"),
          displayOrder: 1,
        })
        .returning({ id: lessons.id });

      return {
        sourceCourseId: sourceCourse.id,
        sourceChapterId: sourceChapter.id,
        sourceLessonId: sourceLesson.id,
      };
    });

    const sourceCookie = ensureCookieArray(await cookieFor(sourceAdmin, app, SOURCE_HOST));
    const targetCookie = ensureCookieArray(await cookieFor(targetAdmin, app, TARGET_HOST));

    await options?.beforeExport?.({
      ...sourceData,
      sourceAdmin,
      targetAdmin,
    });

    const targetCategoryId = options?.createMatchingTargetCategory
      ? await runAsTenant(targetTenantId, async () => {
          const category = await categoryFactory.create({ title: categoryTitle });
          return category.id;
        })
      : undefined;

    const exportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${sourceData.sourceCourseId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    expect(exportResponse.body.data.jobs).toHaveLength(1);
    expect(exportResponse.body.data.jobs[0].queued).toBe(true);

    const exportJobId = exportResponse.body.data.jobs[0].reason;
    expect(typeof exportJobId).toBe("string");

    await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/course/master/export-jobs/${exportJobId}`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as {
          state: string;
          failedReason: string | null;
        };
      },
      (job) => {
        if (job.state === "failed") {
          throw new Error(`Export job failed: ${job.failedReason ?? "unknown reason"}`);
        }

        return job.state === "completed";
      },
    );

    const exportsData = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get(`/api/course/master/${sourceData.sourceCourseId}/exports`)
            .set("Cookie", sourceCookie),
          SOURCE_HOST,
        ).expect(200);

        return response.body.data as Array<{
          targetCourseId: string;
          lastSyncedAt: string | null;
          targetTenantId: string;
        }>;
      },
      (exportsList) =>
        exportsList.length === 1 &&
        exportsList[0].targetTenantId === targetTenantId &&
        exportsList[0].targetCourseId !== sourceData.sourceCourseId &&
        Boolean(exportsList[0].lastSyncedAt),
    );

    return {
      ...sourceData,
      sourceAdmin,
      targetAdmin,
      sourceCookie,
      targetCookie,
      targetCourseId: exportsData[0].targetCourseId,
      targetCategoryId,
    };
  };

  it("forbids export when caller is not a managing-tenant admin", async () => {
    const targetAdmin = await runAsTenant(targetTenantId, async () =>
      userFactory
        .withCredentials({ password: PASSWORD })
        .withAdminSettings(db)
        .create({
          email: `admin+non-managing-${faker.string.alphanumeric(8)}@example.com`,
          role: SYSTEM_ROLE_SLUGS.ADMIN,
          tenantId: targetTenantId,
        }),
    );

    const { courseId } = await runAsTenant(targetTenantId, async () => {
      const category = await categoryFactory.create({ title: "Non-managing category" });
      const createdCourse = await courseFactory.create({
        title: "Non-managing source",
        description: "Should not be exportable by this tenant",
        authorId: targetAdmin.id,
        categoryId: category.id,
      });

      return { courseId: createdCourse.id };
    });

    const targetCookie = ensureCookieArray(await cookieFor(targetAdmin, app, TARGET_HOST));

    await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${courseId}/export`)
        .set("Cookie", targetCookie)
        .send({ targetTenantIds: [sourceTenantId] }),
      TARGET_HOST,
    ).expect(403);
  });

  it("returns export candidates excluding source tenant with export summary", async () => {
    const { sourceCourseId, sourceCookie } = await setupAndExport();

    const response = await withTenantHost(
      request(app.getHttpServer())
        .get(`/api/course/master/${sourceCourseId}/export-candidates`)
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const candidateTenants = response.body.data.tenants as Array<{
      id: string;
      isExported: boolean;
    }>;

    const targetTenantCandidate = candidateTenants.find((tenant) => tenant.id === targetTenantId);

    expect(targetTenantCandidate).toBeDefined();
    expect(targetTenantCandidate?.isExported).toBe(true);
    expect(candidateTenants.some((tenant) => tenant.id === sourceTenantId)).toBe(false);
    expect(response.body.data.summary.totalTenants).toBe(candidateTenants.length);
    expect(response.body.data.summary.exportedCount).toBe(1);
    expect(response.body.data.summary.remainingCount).toBe(candidateTenants.length - 1);
  });

  it("exports source course to target tenant and keeps exported copy readonly", async () => {
    const { sourceCourseId, sourceChapterId, sourceLessonId, targetCourseId, targetCookie } =
      await setupAndExport();

    const targetCourseResponse = await withTenantHost(
      request(app.getHttpServer())
        .get("/api/course/beta-course-by-id")
        .query({ id: targetCourseId, language: "en" })
        .set("Cookie", targetCookie),
      TARGET_HOST,
    ).expect(200);

    expect(targetCourseResponse.body.data.id).toBe(targetCourseId);
    expect(targetCourseResponse.body.data.originType).toBe("exported");
    expect(targetCourseResponse.body.data.isContentReadonly).toBe(true);
    expect(targetCourseResponse.body.data.title).toBe("Master Source Course");
    expect(targetCourseResponse.body.data.description).toBe("Master Source Description");
    expect(targetCourseResponse.body.data.chapters[0].title).toBe("Master Source Chapter");
    expect(targetCourseResponse.body.data.chapters[0].lessons[0].title).toBe(
      "Master Source Lesson",
    );

    await runAsTenant(targetTenantId, async () => {
      const [targetCourse] = await db
        .select({
          title: courses.title,
          description: courses.description,
          status: courses.status,
          priceInCents: courses.priceInCents,
          currency: courses.currency,
          stripeProductId: courses.stripeProductId,
          stripePriceId: courses.stripePriceId,
          baseLanguage: courses.baseLanguage,
          availableLocales: courses.availableLocales,
          categoryId: courses.categoryId,
        })
        .from(courses)
        .where(eq(courses.id, targetCourseId))
        .limit(1);

      expect(targetCourse).toBeDefined();
      expect(targetCourse.title).toEqual({
        en: "Master Source Course",
        pl: "Kurs zrodlowy master",
      });
      expect(targetCourse.description).toEqual({
        en: "Master Source Description",
        pl: "Opis kursu zrodlowego master",
      });
      expect(targetCourse.status).toBe("draft");
      expect(targetCourse.priceInCents).toBe(0);
      expect(targetCourse.currency).toBe("eur");
      expect(targetCourse.stripeProductId).toBeNull();
      expect(targetCourse.stripePriceId).toBeNull();
      expect(targetCourse.baseLanguage).toBe("en");
      expect(targetCourse.availableLocales).toEqual(["en", "pl"]);
      const [targetCategory] = await db
        .select({
          title: categories.title,
          baseLanguage: categories.baseLanguage,
          availableLocales: categories.availableLocales,
        })
        .from(categories)
        .where(eq(categories.id, targetCourse.categoryId))
        .limit(1);

      expect(targetCategory).toBeDefined();
      expect(targetCategory.title).toEqual({
        en: expect.stringMatching(/^Export category /),
        pl: "Kategoria eksportu",
      });
      expect(targetCategory.baseLanguage).toBe("en");
      expect(targetCategory.availableLocales).toEqual(["en", "pl"]);

      const [targetChapter] = await db
        .select({
          title: chapters.title,
          courseId: chapters.courseId,
          authorId: chapters.authorId,
          isFreemium: chapters.isFreemium,
          displayOrder: chapters.displayOrder,
          lessonCount: chapters.lessonCount,
        })
        .from(chapters)
        .where(eq(chapters.courseId, targetCourseId))
        .limit(1);

      expect(targetChapter).toBeDefined();
      expect(targetChapter.title).toEqual({
        en: "Master Source Chapter",
        pl: "Rozdzial zrodlowy master",
      });
      expect(targetChapter.courseId).toBe(targetCourseId);
      expect(targetChapter.authorId).toEqual(expect.any(String));
      expect(targetChapter.isFreemium).toBe(true);
      expect(targetChapter.displayOrder).toBe(7);
      expect(targetChapter.lessonCount).toBe(1);
    });

    await withTenantHost(
      request(app.getHttpServer())
        .patch(`/api/course/${targetCourseId}`)
        .set("Cookie", targetCookie)
        .send({ title: "Should be blocked", language: "en" }),
      TARGET_HOST,
    ).expect(403);

    const targetLessonId = targetCourseResponse.body.data.chapters[0].lessons[0].id as string;

    await withTenantHost(
      request(app.getHttpServer())
        .patch("/api/lesson/beta-update-lesson")
        .query({ id: targetLessonId })
        .set("Cookie", targetCookie)
        .send({ title: "Blocked lesson update", language: "en" }),
      TARGET_HOST,
    ).expect(403);

    await runAsTenant(sourceTenantId, async () => {
      const [sourceCourse] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, sourceCourseId))
        .limit(1);

      const [sourceChapter] = await db
        .select({ id: chapters.id })
        .from(chapters)
        .where(eq(chapters.id, sourceChapterId))
        .limit(1);

      const [sourceLesson] = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.id, sourceLessonId))
        .limit(1);

      expect(sourceCourse).toBeDefined();
      expect(sourceChapter).toBeDefined();
      expect(sourceLesson).toBeDefined();
    });
  });

  it("syncs bulk source category changes to exported courses and creates missing target category", async () => {
    const { sourceCourseId, sourceCookie, targetCourseId } = await setupAndExport();
    const categoryTitle = `Bulk synced category ${faker.string.nanoid(8)}`;

    const sourceCategoryId = await runAsTenant(sourceTenantId, async () => {
      const category = await categoryFactory.create({ title: categoryTitle });

      await db
        .update(categories)
        .set({
          title: buildJsonbFieldWithMultipleEntries({
            en: categoryTitle,
            pl: "Zbiorczo synchronizowana kategoria",
          }),
          baseLanguage: "en",
          availableLocales: ["en", "pl"],
        })
        .where(eq(categories.id, category.id));

      return category.id;
    });

    await withTenantHost(
      request(app.getHttpServer())
        .patch("/api/course/bulk/category")
        .set("Cookie", sourceCookie)
        .send({
          ids: [sourceCourseId],
          categoryId: sourceCategoryId,
        }),
      SOURCE_HOST,
    ).expect(200);

    await waitFor(
      async () =>
        runAsTenant(targetTenantId, async () => {
          const [targetCourse] = await db
            .select({
              categoryTitle: categories.title,
              categoryBaseLanguage: categories.baseLanguage,
              categoryAvailableLocales: categories.availableLocales,
            })
            .from(courses)
            .innerJoin(categories, eq(categories.id, courses.categoryId))
            .where(eq(courses.id, targetCourseId))
            .limit(1);

          return targetCourse;
        }),
      (targetCourse) =>
        targetCourse?.categoryTitle?.en === categoryTitle &&
        targetCourse.categoryTitle.pl === "Zbiorczo synchronizowana kategoria" &&
        targetCourse.categoryBaseLanguage === "en" &&
        targetCourse.categoryAvailableLocales.includes("pl"),
      20000,
    );
  });

  it("returns already-linked and keeps single export link when exporting same course twice", async () => {
    const { sourceCourseId, sourceCookie } = await setupAndExport();

    const secondExportResponse = await withTenantHost(
      request(app.getHttpServer())
        .post(`/api/course/master/${sourceCourseId}/export`)
        .set("Cookie", sourceCookie)
        .send({ targetTenantIds: [targetTenantId] }),
      SOURCE_HOST,
    ).expect(201);

    expect(secondExportResponse.body.data.jobs).toHaveLength(1);
    expect(secondExportResponse.body.data.jobs[0].queued).toBe(false);
    expect(secondExportResponse.body.data.jobs[0].reason).toBe("already-linked");

    const links = await baseDb
      .select({ id: masterCourseExports.id })
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      );

    expect(links).toHaveLength(1);
  });

  it("copies rich-text S3 resources, rewrites localized content, and reuses target resource rows on sync", async () => {
    const sourceResourceId = faker.string.uuid();
    const sourceReference = `course/${faker.string.uuid()}.png`;
    const sourceHtml = `<p><img src="/api/lesson/lesson-resource/${sourceResourceId}" data-resource-id="${sourceResourceId}" /></p>`;
    const sourceHtmlPl = `<p><a href="${SOURCE_HOST}/api/lesson/lesson-resource/${sourceResourceId}" data-resource-id="${sourceResourceId}">plik</a></p>`;

    const { sourceCourseId, sourceLessonId, targetCourseId } = await setupAndExport({
      beforeExport: async ({ sourceLessonId }) => {
        await runAsTenant(sourceTenantId, async () => {
          await db.insert(resources).values({
            id: sourceResourceId,
            title: buildJsonbFieldWithMultipleEntries({
              en: "Source image",
              pl: "Obraz zrodlowy",
            }),
            description: buildJsonbFieldWithMultipleEntries({
              en: "Source image description",
              pl: "Opis obrazu zrodlowego",
            }),
            reference: sourceReference,
            contentType: "image/png",
            metadata: { originalFilename: "source-image.png", checksum: "abc123" },
            uploadedBy: null,
            archived: false,
          });

          await db
            .update(lessons)
            .set({
              description: buildJsonbFieldWithMultipleEntries({
                en: sourceHtml,
                pl: sourceHtmlPl,
              }),
            })
            .where(eq(lessons.id, sourceLessonId));
        });
      },
    });

    const targetRows = await runAsTenant(targetTenantId, async () => {
      const [targetLesson] = await db
        .select({
          id: lessons.id,
          description: lessons.description,
        })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, targetCourseId))
        .limit(1);

      const targetResources = (await db.select().from(resources)).filter((resource) =>
        resource.reference.includes("/master-course/"),
      );
      const targetRelations = await db.select().from(resourceEntity);

      return { targetLesson, targetResources, targetRelations };
    });

    expect(targetRows.targetResources).toHaveLength(1);
    const [targetResource] = targetRows.targetResources;
    expect(targetResource.title).toEqual({ en: "Source image", pl: "Obraz zrodlowy" });
    expect(targetResource.description).toEqual({
      en: "Source image description",
      pl: "Opis obrazu zrodlowego",
    });
    expect(targetResource.reference).not.toBe(sourceReference);
    expect(targetResource.reference).toContain(`${targetTenantId}/master-course/`);
    expect(targetResource.contentType).toBe("image/png");
    expect(targetResource.metadata).toEqual({
      originalFilename: "source-image.png",
      checksum: "abc123",
    });
    expect(targetRows.targetRelations).toEqual([
      expect.objectContaining({
        resourceId: targetResource.id,
        entityId: targetRows.targetLesson.id,
        entityType: "lesson",
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      }),
    ]);
    const targetLessonDescription = targetRows.targetLesson.description as Record<string, string>;

    expect(targetLessonDescription.en).toContain(
      `${TARGET_HOST}/api/lesson/lesson-resource/${targetResource.id}`,
    );
    expect(targetLessonDescription.en).toContain(`data-resource-id="${targetResource.id}"`);
    expect(targetLessonDescription.pl).toContain(
      `${TARGET_HOST}/api/lesson/lesson-resource/${targetResource.id}`,
    );
    expect(targetLessonDescription.pl).not.toContain(sourceResourceId);
    expect(mockS3Service.copyFile).toHaveBeenCalledWith(
      sourceReference,
      expect.stringContaining(`${targetTenantId}/master-course/`),
      "image/png",
    );

    await runAsTenant(sourceTenantId, async () => {
      await db
        .update(lessons)
        .set({ title: buildJsonbField("en", "Synced resource lesson") })
        .where(eq(lessons.id, sourceLessonId));
    });

    const [exportLink] = await baseDb
      .select()
      .from(masterCourseExports)
      .where(
        and(
          eq(masterCourseExports.sourceTenantId, sourceTenantId),
          eq(masterCourseExports.sourceCourseId, sourceCourseId),
          eq(masterCourseExports.targetTenantId, targetTenantId),
        ),
      )
      .limit(1);

    await masterCourseService.processSyncJob({
      exportId: exportLink.id,
      sourceCourseId,
      sourceTenantId,
      targetTenantId,
      triggerEventType: "test",
    });

    await waitFor(
      async () =>
        runAsTenant(targetTenantId, async () => {
          const [targetLesson] = await db
            .select({ title: lessons.title })
            .from(lessons)
            .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
            .where(eq(chapters.courseId, targetCourseId))
            .limit(1);

          return targetLesson?.title as Record<string, string>;
        }),
      (title) => title?.en === "Synced resource lesson",
      20000,
      300,
    );

    const targetResourcesAfterSync = await runAsTenant(targetTenantId, async () => {
      const rows = await db
        .select({ id: resources.id, reference: resources.reference })
        .from(resources);
      return rows.filter((resource) => resource.reference.includes("/master-course/"));
    });
    expect(targetResourcesAfterSync).toEqual([expect.objectContaining({ id: targetResource.id })]);
  });

  it("rewrites fill-in-the-blanks option markers for every localized question description", async () => {
    const sourceOptionId = faker.string.uuid();
    const untouchedOptionId = faker.string.uuid();

    const { targetCourseId } = await setupAndExport({
      beforeExport: async ({ sourceAdmin, sourceLessonId }) => {
        await runAsTenant(sourceTenantId, async () => {
          const [question] = await db
            .insert(questions)
            .values({
              id: faker.string.uuid(),
              lessonId: sourceLessonId,
              authorId: sourceAdmin.id,
              type: QUESTION_TYPE.FILL_IN_THE_BLANKS_TEXT,
              title: buildJsonbFieldWithMultipleEntries({
                en: "Fill blank",
                pl: "Uzupelnij luke",
              }),
              description: buildJsonbFieldWithMultipleEntries({
                en: `Answer <blank-answer-${sourceOptionId}> now`,
                pl: `Odpowiedz <blank-answer-${sourceOptionId}> teraz`,
              }),
              solutionExplanation: buildJsonbField("en", "Because it matches"),
              displayOrder: 1,
            })
            .returning({ id: questions.id });

          await db.insert(questionAnswerOptions).values([
            {
              id: sourceOptionId,
              questionId: question.id,
              optionText: buildJsonbFieldWithMultipleEntries({
                en: "Correct",
                pl: "Poprawna",
              }),
              matchedWord: buildJsonbFieldWithMultipleEntries({
                en: "Correct",
                pl: "Poprawna",
              }),
              isCorrect: true,
              displayOrder: 1,
            },
            {
              id: untouchedOptionId,
              questionId: question.id,
              optionText: buildJsonbField("en", "Distractor"),
              isCorrect: false,
              displayOrder: 2,
            },
          ]);
        });
      },
    });

    const targetQuestionData = await runAsTenant(targetTenantId, async () => {
      const [targetQuestion] = await db
        .select({
          id: questions.id,
          description: questions.description,
        })
        .from(questions)
        .innerJoin(lessons, eq(lessons.id, questions.lessonId))
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, targetCourseId))
        .limit(1);

      const targetOptions = await db
        .select({
          id: questionAnswerOptions.id,
          optionText: questionAnswerOptions.optionText,
        })
        .from(questionAnswerOptions)
        .where(eq(questionAnswerOptions.questionId, targetQuestion.id));

      return { targetQuestion, targetOptions };
    });

    const targetCorrectOption = targetQuestionData.targetOptions.find((option) => {
      const optionText = option.optionText as Record<string, string>;
      return optionText.en === "Correct";
    });
    const targetQuestionDescription = targetQuestionData.targetQuestion.description as Record<
      string,
      string
    >;

    expect(targetCorrectOption).toBeDefined();
    expect(targetCorrectOption?.id).not.toBe(sourceOptionId);
    expect(targetQuestionDescription.en).toContain(`<blank-answer-${targetCorrectOption?.id}>`);
    expect(targetQuestionDescription.pl).toContain(`<blank-answer-${targetCorrectOption?.id}>`);
    expect(targetQuestionDescription.en).not.toContain(sourceOptionId);
    expect(targetQuestionDescription.pl).not.toContain(sourceOptionId);
  });

  it("reuses Bunny video references when source and target share the same Bunny media configuration", async () => {
    mockBunnyStreamService.isConfigured.mockResolvedValue(true);
    mockBunnyStreamService.getMediaConfigurationSignature.mockResolvedValue("same-config");

    const sourceBunnyReference = "bunny-source-video";
    const { targetCourseId } = await setupAndExport({
      beforeExport: async ({ sourceLessonId }) => {
        await runAsTenant(sourceTenantId, async () => {
          await db
            .update(lessons)
            .set({ fileS3Key: sourceBunnyReference, fileType: "mp4" })
            .where(eq(lessons.id, sourceLessonId));
        });
      },
    });

    const [targetLesson] = await runAsTenant(targetTenantId, async () =>
      db
        .select({ fileS3Key: lessons.fileS3Key })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, targetCourseId))
        .limit(1),
    );

    expect(targetLesson.fileS3Key).toBe(sourceBunnyReference);
    expect(mockBunnyStreamService.downloadMp4Fallback).not.toHaveBeenCalled();
    expect(mockBunnyStreamService.uploadStream).not.toHaveBeenCalled();
  });

  it("streams Bunny source videos into target S3 when target tenant does not use Bunny", async () => {
    mockBunnyStreamService.isConfigured.mockResolvedValue(false);
    const sourceBunnyReference = "bunny-source-video";

    const { targetCourseId } = await setupAndExport({
      beforeExport: async ({ sourceLessonId }) => {
        await runAsTenant(sourceTenantId, async () => {
          await db
            .update(lessons)
            .set({ fileS3Key: sourceBunnyReference, fileType: "mp4" })
            .where(eq(lessons.id, sourceLessonId));
        });
      },
    });

    const [targetLesson] = await runAsTenant(targetTenantId, async () =>
      db
        .select({ fileS3Key: lessons.fileS3Key })
        .from(lessons)
        .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
        .where(eq(chapters.courseId, targetCourseId))
        .limit(1),
    );

    expect(mockBunnyStreamService.downloadMp4Fallback).toHaveBeenCalledWith(
      "source-video",
      720,
      SOURCE_HOST,
    );
    expect(mockS3Service.uploadStreamMultipart).toHaveBeenCalledWith(
      expect.any(Readable),
      expect.stringContaining(`${targetTenantId}/master-course/`),
      "video/mp4",
    );
    expect(targetLesson.fileS3Key).toContain(`${targetTenantId}/master-course/`);
    expect(targetLesson.fileS3Key).toMatch(/\.mp4$/);
  });

  it("propagates lesson deletion from source tenant to exported target course", async () => {
    const { sourceLessonId, sourceCookie, targetCookie, targetCourseId } = await setupAndExport();

    await withTenantHost(
      request(app.getHttpServer())
        .delete("/api/lesson")
        .query({ lessonId: sourceLessonId })
        .set("Cookie", sourceCookie),
      SOURCE_HOST,
    ).expect(200);

    const syncedTargetCourse = await waitFor(
      async () => {
        const response = await withTenantHost(
          request(app.getHttpServer())
            .get("/api/course/beta-course-by-id")
            .query({ id: targetCourseId, language: "en" })
            .set("Cookie", targetCookie),
          TARGET_HOST,
        ).expect(200);

        return response.body.data as {
          chapters: Array<{ lessons: Array<{ title: string }> }>;
        };
      },
      (data) =>
        data.chapters.every((chapter) =>
          chapter.lessons.every((lesson) => lesson.title !== "Master Source Lesson"),
        ),
      20000,
      300,
    );

    expect(
      syncedTargetCourse.chapters.some((chapter) =>
        chapter.lessons.some((lesson) => lesson.title === "Master Source Lesson"),
      ),
    ).toBe(false);
  });
});
