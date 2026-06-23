import { join } from "node:path";

import { ENTITY_TYPES, RESOURCE_LIBRARY_ASSET_TYPE, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { FileService } from "src/file/file.service";
import { FileGuard } from "src/file/guards/file.guard";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { lessons, resourceEntity, resources } from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createArticleFactory } from "../../../test/factory/article.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";
import { ResourceLibraryService } from "../resource-library.service";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

const resourceLibraryUploadFixturePath = join(
  __dirname,
  "../../../../web/e2e/data/curriculum/files/content-image.png",
);

describe("ResourceLibraryController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let userFactory: ReturnType<typeof createUserFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;
  let articleFactory: ReturnType<typeof createArticleFactory>;
  let resourceLibraryService: ResourceLibraryService;

  const password = "Password123!";
  const mockFileService = {
    uploadResource: jest.fn(),
  };

  const createAdmin = () =>
    userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

  const createStudent = () =>
    userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

  const createLesson = async (
    authorId: UUIDType,
    overrides: { title?: string; description?: string } = {},
  ) => {
    const course = await courseFactory.create({ authorId });
    const chapter = await chapterFactory.create({ courseId: course.id, authorId });

    const [lesson] = await db
      .insert(lessons)
      .values({
        chapterId: chapter.id,
        type: LESSON_TYPES.CONTENT,
        title: buildJsonbField("en", overrides.title ?? "Resource lesson"),
        description: buildJsonbField("en", overrides.description ?? "<p>Lesson content</p>"),
        displayOrder: 1,
      })
      .returning();

    return lesson;
  };

  const createResource = async ({
    metadata,
    ...overrides
  }: Partial<typeof resources.$inferInsert> = {}): Promise<typeof resources.$inferSelect> => {
    const [resource] = await db
      .insert(resources)
      .values({
        title: buildJsonbField("en", "Library asset"),
        description: buildJsonbField("en", "Library asset description"),
        reference: "resource-library/library-asset.pdf",
        contentType: "application/pdf",
        metadata: settingsToJSONBuildObject({
          originalFilename: "library-asset.pdf",
          size: 1234,
          ...((metadata as Record<string, unknown> | undefined) ?? {}),
        }),
        ...overrides,
      })
      .returning();

    return resource;
  };

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest([
      {
        provide: FileService,
        useValue: mockFileService,
      },
    ]);

    app = testApp;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
    articleFactory = createArticleFactory(db);
    resourceLibraryService = app.get(ResourceLibraryService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await truncateAllTables(baseDb, db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/resource-library/assets", () => {
    it("requires a signed-in user with resource library permissions", async () => {
      await request(app.getHttpServer()).get("/api/resource-library/assets").expect(401);

      const student = await createStudent();

      await request(app.getHttpServer())
        .get("/api/resource-library/assets")
        .set("Cookie", await cookieFor(student, app))
        .expect(403);
    });

    it("returns paginated assets with search, type, language, and usage count", async () => {
      const admin = await createAdmin();
      const lesson = await createLesson(admin.id);
      const imageAsset = await createResource({
        title: buildJsonbField("en", "Alpha image"),
        reference: "assets/alpha-image.png",
        contentType: "image/png",
        metadata: {
          originalFilename: "alpha-image.png",
          size: 456,
        },
        uploadedBy: admin.id,
      });

      await createResource({
        title: buildJsonbField("en", "Unmatched PDF"),
        reference: "assets/unmatched.pdf",
        contentType: "application/pdf",
      });
      await createResource({
        title: buildJsonbField("en", "Archived alpha image"),
        reference: "assets/archived-alpha.png",
        contentType: "image/png",
        archived: true,
      });
      await db.insert(resourceEntity).values({
        resourceId: imageAsset.id,
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });

      const response = await request(app.getHttpServer())
        .get("/api/resource-library/assets")
        .query({
          language: "en",
          page: 1,
          perPage: 10,
          search: "alpha",
          type: RESOURCE_LIBRARY_ASSET_TYPE.IMAGE,
        })
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.pagination).toMatchObject({
        page: 1,
        perPage: 10,
        totalItems: 1,
      });
      expect(response.body.appliedFilters).toMatchObject({
        search: "alpha",
        type: RESOURCE_LIBRARY_ASSET_TYPE.IMAGE,
      });
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id: imageAsset.id,
        fileName: "Alpha image",
        title: "Alpha image",
        contentType: "image/png",
        type: RESOURCE_LIBRARY_ASSET_TYPE.IMAGE,
        size: 456,
        originalFilename: "alpha-image.png",
        reference: "assets/alpha-image.png",
        uploadedBy: admin.id,
        usageCount: 1,
      });
    });
  });

  describe("GET /api/resource-library/assets/:id/usages", () => {
    it("returns relation and rich-text usages without duplicate entities", async () => {
      const admin = await createAdmin();
      const asset = await createResource({
        title: buildJsonbField("en", "Shared asset"),
        contentType: "image/png",
        reference: "assets/shared.png",
      });
      const lesson = await createLesson(admin.id, {
        title: "Lesson usage",
        description: `<p><img data-resource-id="${asset.id}" src="/api/lesson/lesson-resource/${asset.id}" /></p>`,
      });
      const article = await articleFactory.create({
        authorId: admin.id,
        title: "Article usage",
        content: `<p><a href="/api/articles/articles-resource/${asset.id}">Download</a></p>`,
      });

      await db.insert(resourceEntity).values({
        resourceId: asset.id,
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });

      const response = await request(app.getHttpServer())
        .get(`/api/resource-library/assets/${asset.id}/usages`)
        .query({ language: "en" })
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: lesson.id,
            entityType: ENTITY_TYPES.LESSON,
            title: "Lesson usage",
            relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
          }),
          expect.objectContaining({
            entityId: article.id,
            entityType: ENTITY_TYPES.ARTICLES,
            title: "Article usage",
            relationshipType: RESOURCE_RELATIONSHIP_TYPES.CONTENT,
          }),
        ]),
      );
    });

    it("returns 404 for an unknown asset", async () => {
      const admin = await createAdmin();

      await request(app.getHttpServer())
        .get(`/api/resource-library/assets/${crypto.randomUUID()}/usages`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(404);
    });
  });

  describe("POST /api/resource-library/assets/:id/link and unlink", () => {
    it("links and unlinks an asset from a rich-text entity", async () => {
      const admin = await createAdmin();
      const asset = await createResource();
      const lesson = await createLesson(admin.id);
      const cookie = await cookieFor(admin, app);

      const linkResponse = await request(app.getHttpServer())
        .post(`/api/resource-library/assets/${asset.id}/link`)
        .set("Cookie", cookie)
        .send({
          entityId: lesson.id,
          entityType: ENTITY_TYPES.LESSON,
        })
        .expect(201);

      expect(linkResponse.body.data).toEqual({
        resourceId: asset.id,
        url: `/api/lesson/lesson-resource/${asset.id}`,
      });

      const relationsAfterLink = await db
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, asset.id));

      expect(relationsAfterLink).toHaveLength(1);
      expect(relationsAfterLink[0]).toMatchObject({
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });

      const unlinkResponse = await request(app.getHttpServer())
        .post(`/api/resource-library/assets/${asset.id}/unlink`)
        .set("Cookie", cookie)
        .send({
          entityId: lesson.id,
          entityType: ENTITY_TYPES.LESSON,
        })
        .expect(201);

      expect(unlinkResponse.body.data).toEqual({
        resourceId: asset.id,
        deletedUsages: 1,
      });

      const relationsAfterUnlink = await db
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, asset.id));

      expect(relationsAfterUnlink).toHaveLength(0);
    });
  });

  describe("resource relation sync", () => {
    it("preserves relations that are still referenced and removes stale relations", async () => {
      const admin = await createAdmin();
      const keptAsset = await createResource();
      const staleAsset = await createResource();
      const lesson = await createLesson(admin.id, {
        description: `<p><img src="/api/lesson/lesson-resource/${keptAsset.id}" /></p>`,
      });

      const [keptRelation] = await db
        .insert(resourceEntity)
        .values({
          resourceId: keptAsset.id,
          entityId: lesson.id,
          entityType: ENTITY_TYPES.LESSON,
          relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
        })
        .returning();

      await db.insert(resourceEntity).values({
        resourceId: staleAsset.id,
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });

      await resourceLibraryService.syncLessonAssetRelations(lesson.id);

      const relations = await db
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.entityId, lesson.id));

      expect(relations).toHaveLength(1);
      expect(relations[0]).toMatchObject({
        id: keptRelation.id,
        resourceId: keptAsset.id,
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });
    });
  });

  describe("POST /api/resource-library/assets/upload", () => {
    it("uploads an asset through FileService and returns the rich-text URL", async () => {
      const admin = await createAdmin();
      const lesson = await createLesson(admin.id);
      const resourceId = crypto.randomUUID();

      mockFileService.uploadResource.mockResolvedValueOnce({
        resourceId,
        fileUrl: "https://cdn.example.test/resource-library/uploaded.png",
      });
      jest.spyOn(FileGuard, "getFileType").mockResolvedValueOnce({
        ext: "png",
        mime: "image/png",
      });

      const response = await request(app.getHttpServer())
        .post("/api/resource-library/assets/upload")
        .set("Cookie", await cookieFor(admin, app))
        .field("entityType", ENTITY_TYPES.LESSON)
        .field("entityId", lesson.id)
        .field("language", "en")
        .field("title", "uploaded.png")
        .field("description", "uploaded.png")
        .attach("file", resourceLibraryUploadFixturePath, {
          filename: "uploaded.png",
          contentType: "image/png",
        })
        .expect((response) => {
          if (response.status !== 201) {
            throw new Error(
              `Expected 201, got ${response.status}: ${JSON.stringify(response.body)}`,
            );
          }
        });

      expect(response.body.data).toEqual({
        resourceId,
        url: `/api/lesson/lesson-resource/${resourceId}`,
        fileUrl: "https://cdn.example.test/resource-library/uploaded.png",
      });
      expect(mockFileService.uploadResource).toHaveBeenCalledWith(
        expect.objectContaining({
          folder: lesson.id,
          resource: "lesson",
          title: { en: "uploaded.png" },
          description: { en: "uploaded.png" },
          options: {
            contextId: undefined,
          },
          currentUser: expect.objectContaining({
            userId: admin.id,
          }),
          file: expect.objectContaining({
            originalname: "uploaded.png",
            mimetype: "image/png",
          }),
        }),
      );
    });
  });

  describe("DELETE /api/resource-library/assets/:id", () => {
    it("archives an asset, deletes relations, and removes rich-text references", async () => {
      const admin = await createAdmin();
      const asset = await createResource({
        contentType: "image/png",
        reference: "assets/delete-me.png",
      });
      const lesson = await createLesson(admin.id, {
        description: `<p>Before</p><img src="/api/lesson/lesson-resource/${asset.id}" /><p>After</p>`,
      });

      await db.insert(resourceEntity).values({
        resourceId: asset.id,
        entityId: lesson.id,
        entityType: ENTITY_TYPES.LESSON,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      });

      const response = await request(app.getHttpServer())
        .delete(`/api/resource-library/assets/${asset.id}`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(response.body.data).toEqual({
        message: "resourceLibrary.toast.assetDeletedSuccessfully",
        deletedUsages: 1,
      });

      const [archivedAsset] = await db
        .select({ archived: resources.archived })
        .from(resources)
        .where(eq(resources.id, asset.id));
      const remainingRelations = await db
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, asset.id));
      const [updatedLesson] = await db
        .select({ description: lessons.description })
        .from(lessons)
        .where(eq(lessons.id, lesson.id));

      expect(archivedAsset.archived).toBe(true);
      expect(remainingRelations).toHaveLength(0);
      expect(JSON.stringify(updatedLesson.description)).not.toContain(asset.id);
      expect(JSON.stringify(updatedLesson.description)).toContain("Before");
      expect(JSON.stringify(updatedLesson.description)).toContain("After");
    });
  });
});
