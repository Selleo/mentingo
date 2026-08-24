import { faker } from "@faker-js/faker";
import {
  COURSE_ENROLLMENT,
  ENTITY_TYPES,
  LESSON_TYPES,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import request from "supertest";

import { buildJsonbField, buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import {
  SEARCH_DOCUMENT_TYPES,
  SEARCH_DOCUMENT_WEIGHTS,
  SEARCH_ENTITY_TYPES,
} from "src/global-search/global-search.constants";
import { SearchIndexService } from "src/global-search/search-index.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { lessons, news, resourceEntity, resources, studentCourses } from "src/storage/schema";
import { PROGRESS_STATUSES } from "src/utils/types/progress.type";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createQAFactory } from "../../../test/factory/qa.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { GlobalSearchResponse } from "src/global-search/schemas/global-search.schema";

describe("GlobalSearchController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let searchIndexService: SearchIndexService;
  let userFactory: ReturnType<typeof createUserFactory>;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let qaFactory: ReturnType<typeof createQAFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  const password = "Password123!";

  const createAdminCookie = async () => {
    const admin = await userFactory.withCredentials({ password }).withAdminSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.ADMIN,
    });

    return cookieFor(admin, app);
  };

  const createStudentCookie = async () => {
    const student = await userFactory.withCredentials({ password }).withUserSettings(db).create({
      role: SYSTEM_ROLE_SLUGS.STUDENT,
    });

    return cookieFor(student, app);
  };

  const indexQA = async (
    qaId: UUIDType,
    documents: Array<{ language: SupportedLanguages; content: string }>,
  ) => {
    await searchIndexService.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.QA,
      entityId: qaId,
      documents: documents.map((document) => ({
        documentType: SEARCH_DOCUMENT_TYPES.TITLE,
        language: document.language,
        content: document.content,
        weight: SEARCH_DOCUMENT_WEIGHTS.A,
      })),
    });
  };

  const search = async (
    cookie: string | string[],
    searchQuery: string,
    language: SupportedLanguages,
  ): Promise<GlobalSearchResponse> => {
    const searchRequest = request(app.getHttpServer())
      .get("/api/global-search")
      .query({ searchQuery, language });

    if (Array.isArray(cookie)) {
      searchRequest.set("Cookie", cookie);
    } else {
      searchRequest.set("Cookie", cookie);
    }

    const response = await searchRequest.expect(200);

    return response.body.data;
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    searchIndexService = app.get(SearchIndexService);

    userFactory = createUserFactory(db);
    settingsFactory = createSettingsFactory(db);
    qaFactory = createQAFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(baseDb, [
      "search_documents",
      "resource_entity",
      "resources",
      "lessons",
      "chapters",
      "student_courses",
      "courses",
      "news",
      "questions_and_answers",
      "categories",
      "settings",
      "credentials",
      "user_onboarding",
      "users",
    ]);
    await settingsFactory.create({ userId: null });
  });

  it("returns categories that match the search query", async () => {
    const cookie = await createAdminCookie();
    const category = await categoryFactory.create({ title: "Searchable category" });

    const results = await search(cookie, "Searchable", SUPPORTED_LANGUAGES.EN);

    expect(results.categories).toEqual([expect.objectContaining({ id: category.id })]);
  });

  it("returns enrolled course progress in my course results", async () => {
    const student = await userFactory.withCredentials({ password }).withUserSettings(db).create();
    const author = await userFactory.create();
    const course = await courseFactory.create({
      authorId: author.id,
      title: "Progress search course",
      chapterCount: 3,
    });

    await db.insert(studentCourses).values({
      studentId: student.id,
      courseId: course.id,
      progress: PROGRESS_STATUSES.IN_PROGRESS,
      finishedChapterCount: 2,
      status: COURSE_ENROLLMENT.ENROLLED,
      tenantId: student.tenantId,
    });
    await searchIndexService.refreshCourse(course.id);

    const results = await search(
      await cookieFor(student, app),
      "Progress search",
      SUPPORTED_LANGUAGES.EN,
    );

    expect(results.myCourses).toEqual([
      expect.objectContaining({
        id: course.id,
        completedChapterCount: 2,
        courseChapterCount: 3,
      }),
    ]);
  });

  it("uses requested-language search documents when they exist and match", async () => {
    const cookie = await createAdminCookie();
    const qa = await qaFactory.create({
      title: "Requested language QA",
      description: "Answer",
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
    });
    await indexQA(qa.id, [
      { language: SUPPORTED_LANGUAGES.EN, content: "english-only-topic" },
      { language: SUPPORTED_LANGUAGES.PL, content: "polish-only-topic" },
    ]);

    const results = await search(cookie, "polish", SUPPORTED_LANGUAGES.PL);

    expect(results.qa).toEqual([expect.objectContaining({ id: qa.id })]);
  });

  it("searches non-requested language documents when requested-language documents are absent", async () => {
    const cookie = await createAdminCookie();
    const qa = await qaFactory.create({
      title: "Base language QA",
      description: "Answer",
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
    });
    await indexQA(qa.id, [{ language: SUPPORTED_LANGUAGES.EN, content: "basefallback-topic" }]);

    const results = await search(cookie, "basefallback", SUPPORTED_LANGUAGES.PL);

    expect(results.qa).toEqual([expect.objectContaining({ id: qa.id })]);
  });

  it("searches all indexed languages even when requested-language documents exist", async () => {
    const cookie = await createAdminCookie();
    const qa = await qaFactory.create({
      title: "All language QA",
      description: "Answer",
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN, SUPPORTED_LANGUAGES.PL],
    });
    await indexQA(qa.id, [
      { language: SUPPORTED_LANGUAGES.EN, content: "hiddenbase-topic" },
      { language: SUPPORTED_LANGUAGES.PL, content: "visible-polish-topic" },
    ]);

    const results = await search(cookie, "visible-polish", SUPPORTED_LANGUAGES.EN);

    expect(results.qa).toEqual([expect.objectContaining({ id: qa.id })]);
  });

  it("returns entities that match through different indexed languages in one search", async () => {
    const cookie = await createAdminCookie();
    const englishQa = await qaFactory.create({
      title: "English indexed QA",
      description: "Answer",
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
    });
    const polishQa = await qaFactory.create({
      title: "Polish indexed QA",
      description: "Answer",
      baseLanguage: SUPPORTED_LANGUAGES.PL,
      availableLocales: [SUPPORTED_LANGUAGES.PL],
    });
    await indexQA(englishQa.id, [
      { language: SUPPORTED_LANGUAGES.EN, content: "sharedmultilingual-topic" },
    ]);
    await indexQA(polishQa.id, [
      { language: SUPPORTED_LANGUAGES.PL, content: "sharedmultilingual-topic" },
    ]);

    const results = await search(cookie, "sharedmultilingual", SUPPORTED_LANGUAGES.EN);

    expect(results.qa).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: englishQa.id }),
        expect.objectContaining({ id: polishQa.id }),
      ]),
    );
  });

  it("shows public content when any matched language is available", async () => {
    const cookie = await createStudentCookie();
    const author = await userFactory.create();
    const [newsItem] = await db
      .insert(news)
      .values({
        title: buildJsonbFieldWithMultipleEntries({
          [SUPPORTED_LANGUAGES.PL]: "Public Polish news",
        }),
        summary: buildJsonbField(SUPPORTED_LANGUAGES.PL, "Summary"),
        content: buildJsonbField(SUPPORTED_LANGUAGES.PL, "Content"),
        status: "published",
        isPublic: true,
        archived: false,
        baseLanguage: SUPPORTED_LANGUAGES.PL,
        availableLocales: [SUPPORTED_LANGUAGES.PL],
        publishedAt: new Date().toISOString(),
        authorId: author.id,
      })
      .returning();
    await searchIndexService.replaceEntityDocuments({
      entityType: SEARCH_ENTITY_TYPES.NEWS,
      entityId: newsItem.id,
      documents: [
        {
          documentType: SEARCH_DOCUMENT_TYPES.TITLE,
          language: SUPPORTED_LANGUAGES.PL,
          content: "publicpolish-topic",
          weight: SEARCH_DOCUMENT_WEIGHTS.A,
        },
      ],
    });

    const results = await search(cookie, "publicpolish", SUPPORTED_LANGUAGES.EN);

    expect(results.news).toEqual([expect.objectContaining({ id: newsItem.id })]);
  });

  it("uses the matched non-requested language when resolving lesson attachment matches", async () => {
    const cookie = await createAdminCookie();
    const author = await userFactory.create();
    const category = await categoryFactory.create();
    const course = await courseFactory.create({
      authorId: author.id,
      categoryId: category.id,
      title: "Attachment fallback course",
      description: "Course description",
      thumbnailS3Key: null,
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
    });
    const chapter = await chapterFactory.create({
      authorId: author.id,
      courseId: course.id,
      title: "Attachment fallback chapter",
      displayOrder: 1,
      lessonCount: 1,
    });
    const [lesson] = await db
      .insert(lessons)
      .values({
        chapterId: chapter.id,
        type: LESSON_TYPES.CONTENT,
        title: buildJsonbFieldWithMultipleEntries({
          [SUPPORTED_LANGUAGES.EN]: "Attachment fallback lesson",
        }),
        description: buildJsonbField(SUPPORTED_LANGUAGES.EN, "Lesson description"),
        displayOrder: 1,
      })
      .returning();
    const attachmentSearchToken = `resourceguide${faker.string.alphanumeric(8).toLowerCase()}`;
    const originalFilename = attachmentSearchToken;
    const [resource] = await db
      .insert(resources)
      .values({
        title: buildJsonbField(SUPPORTED_LANGUAGES.EN, "Resource title"),
        description: buildJsonbField(SUPPORTED_LANGUAGES.EN, "Resource description"),
        reference: `uploads/${originalFilename}`,
        contentType: "application/pdf",
        metadata: { originalFilename },
        uploadedBy: author.id,
      })
      .returning();

    await db.insert(resourceEntity).values({
      resourceId: resource.id,
      entityId: lesson.id,
      entityType: ENTITY_TYPES.LESSON,
      relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
    });
    await searchIndexService.refreshLesson(lesson.id);

    const results = await search(cookie, attachmentSearchToken, SUPPORTED_LANGUAGES.PL);

    expect(results.lessons).toEqual([
      expect.objectContaining({
        id: lesson.id,
        matchedAttachmentFileName: originalFilename,
      }),
    ]);
  });
});
