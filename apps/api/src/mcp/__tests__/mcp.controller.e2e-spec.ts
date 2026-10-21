import { randomUUID } from "node:crypto";

import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  COURSE_ENROLLMENT,
  COURSE_STATUSES,
  LESSON_TYPES,
  SYSTEM_ROLE_SLUGS,
  TENANT_STATUSES,
} from "@repo/shared";
import { and, eq, inArray, isNull } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { SearchIndexService } from "src/global-search/search-index.service";
import {
  normalizeSearchText,
  chunkSearchText,
} from "src/global-search/semantic-search-index.chunking";
import { SemanticSearchEmbeddingService } from "src/global-search/semantic-search-index.embedding.service";
import { SemanticSearchIndexRepository } from "src/global-search/semantic-search-index.repository";
import { DB } from "src/storage/db/db.providers";
import {
  users,
  tenants,
  settings,
  groups,
  groupUsers,
  courses,
  permissionUserRoles,
  resourceEntity,
  searchDocuments,
  studentCourses,
  studentLessonProgress,
  assessments,
  assessmentQuestions,
  assessmentQuestionChoiceOptions,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createArticleFactory } from "../../../test/factory/article.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createNewsFactory } from "../../../test/factory/news.factory";
import { createQAFactory } from "../../../test/factory/qa.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { McpTokenService } from "../mcp-token.service";
import { MCP_SCOPES } from "../mcp-tool-scope";

import type { UserWithCredentials } from "../../../test/factory/user.factory";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { Response, Test } from "supertest";

const pdf = Buffer.from(
  "JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDAvS2lkc1tdPj4KZW5kb2JqCnhyZWYKMCAzCjAwMDAwMDAwMDAgNjU1MzUgZgowMDAwMDAwMDA5IDAwMDAwIG4KMDAwMDAwMDA1OCAwMDAwMCBuCnRyYWlsZXI8PC9TaXplIDMvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoxMTYKJSVFT0Y=",
  "base64",
);

type Client = { token: string; host: string; tenantId: string; user: UserWithCredentials };
type ToolResult = Record<string, any>;

/** Exercises the real protocol, auth guards, RLS, domain services and isolated S3 storage. */
describe("MCP HTTP administrative and upload workflows (e2e)", () => {
  const originalRateLimiting = process.env.DISABLE_RATE_LIMITING;
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let runAsTenant: <T>(tenantId: string, work: () => Promise<T>) => Promise<T>;
  let admin: Client;
  let student: Client;
  let foreign: Client;
  let target: UserWithCredentials;
  let png: Buffer;
  let seq = 0;
  let articleId: string;
  let newsId: string;
  let draftCourseId: string;
  let publishedCourseId: string;
  let draftArticleId: string;
  let draftNewsId: string;
  let qaId: string;
  let adminCookie: string;

  function http(path: string, method: "post" | "patch" | "get" = "post", client = admin): Test {
    return request(app.getHttpServer())
      [method](path)
      .set("Host", client.host)
      .set("Referer", `http://${client.host}/`);
  }

  function parseRpc(response: Response): ToolResult {
    if (response.body?.jsonrpc) return response.body;
    const events = response.text.split(/\r?\n/).filter((line) => line.startsWith("data:"));
    const messages = events.map((line) => JSON.parse(line.slice(5).trim()));
    const result = messages.find((message) => message.id !== undefined);
    if (!result)
      throw new Error(`No JSON-RPC response: ${response.status} ${response.text.slice(0, 500)}`);
    return result;
  }

  async function rpc(
    client: Client,
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<ToolResult> {
    const response = await http("/api/mcp", "post", client)
      .set("Authorization", `Bearer ${client.token}`)
      .set("Accept", "application/json, text/event-stream")
      .set("MCP-Protocol-Version", "2025-11-25")
      .send({ jsonrpc: "2.0", id: ++seq, method, params })
      .expect(200);
    return parseRpc(response);
  }

  async function call(
    name: string,
    args: Record<string, unknown> = {},
    client = admin,
  ): Promise<ToolResult> {
    const response = await rpc(client, "tools/call", { name, arguments: args });
    if (response.error || response.result?.isError)
      throw new Error(`${name}: ${JSON.stringify(response.error ?? response.result)}`);
    const result = response.result.structuredContent ?? JSON.parse(response.result.content[0].text);
    return result;
  }

  async function rejectedCall(name: string, args: Record<string, unknown>, client = admin) {
    const response = await rpc(client, "tools/call", { name, arguments: args });
    expect(Boolean(response.error || response.result?.isError)).toBe(true);
    return response;
  }

  async function issueClient(
    user: UserWithCredentials,
    host: string,
    scopes: string[] = [MCP_SCOPES.ACCOUNT_ACCESS],
  ): Promise<Client> {
    const token = await app.get(McpTokenService).issue({
      userId: user.id,
      tenantId: user.tenantId,
      clientId: "mcp-http-e2e",
      resource: `http://${host}/api/mcp`,
      scopes,
    });
    return { token, host, tenantId: user.tenantId, user };
  }

  async function imageGrant(client = admin) {
    return call(
      "request_platform_image_upload",
      { kind: "platformLogo", filename: "asset.png", mimeType: "image/png", size: png.length },
      client,
    );
  }

  function upload(
    grant: ToolResult,
    bytes: Buffer,
    options: {
      client?: Client;
      path?: string;
      method?: "patch" | "post";
      filename?: string;
      mimeType?: string;
      fields?: Record<string, string>;
    } = {},
  ): Test {
    const client = options.client ?? admin;
    const path = options.path ?? new URL(grant.uploadRequest.url).pathname;
    const method = options.method ?? grant.uploadRequest.method.toLowerCase();
    const req = http(path, method, client).set(
      "Authorization",
      grant.uploadRequest.headers.Authorization,
    );
    for (const [name, value] of Object.entries(options.fields ?? grant.uploadRequest.fields))
      req.field(name, String(value));
    return req.attach(grant.uploadRequest.fileField, bytes, {
      filename: options.filename ?? grant.acceptedFile.filename,
      contentType: options.mimeType ?? grant.acceptedFile.mimeType,
    });
  }

  beforeAll(async () => {
    // Protocol workflows issue many requests; throttling has its own policy tests.
    process.env.DISABLE_RATE_LIMITING = "true";
    const setup = await createE2ETest({ useDbProxy: true });
    app = setup.app;
    app.useLogger(["error"]);
    db = app.get(DB);
    baseDb = setup.dbAdmin;
    runAsTenant = setup.runAsTenant;
    await app.listen(0, "127.0.0.1");
    const host = `mcp-${randomUUID()}.local`;
    const foreignHost = `mcp-${randomUUID()}.local`;
    await baseDb
      .update(tenants)
      .set({ host: `http://${host}`, status: TENANT_STATUSES.ACTIVE })
      .where(eq(tenants.id, setup.defaultTenantId));
    const [secondTenant] = await baseDb
      .insert(tenants)
      .values({
        name: "MCP isolation",
        host: `http://${foreignHost}`,
        status: TENANT_STATUSES.ACTIVE,
      })
      .returning();
    const factory = createUserFactory(db);
    const first = await runAsTenant(setup.defaultTenantId, async () => {
      await createSettingsFactory(db).create();
      const adminUser = await factory
        .withCredentials({ password: "Mcp-Test-Password123!" })
        .withAdminSettings(db)
        .create({ tenantId: setup.defaultTenantId, roleSlug: SYSTEM_ROLE_SLUGS.ADMIN });
      const studentUser = await factory
        .withUserSettings(db)
        .create({ tenantId: setup.defaultTenantId, roleSlug: SYSTEM_ROLE_SLUGS.STUDENT });
      target = await factory
        .withUserSettings(db)
        .create({ tenantId: setup.defaultTenantId, firstName: "MCP searchable person" });
      const article = await createArticleFactory(db).create({
        authorId: adminUser.id,
        title: "MCP editorial article",
        content: "<p>Keep article body</p>",
        isPublic: true,
      });
      const news = await createNewsFactory(db).create({
        authorId: adminUser.id,
        title: "MCP editorial news",
        content: "<p>Keep news body</p>",
        isPublic: true,
      });
      articleId = article.id;
      newsId = news.id;
      const publishedCourse = await createCourseFactory(db).create({
        authorId: adminUser.id,
        title: "MCP learner-visible course",
        status: "published",
        thumbnailS3Key: null,
      });
      publishedCourseId = publishedCourse.id;
      const draftArticle = await createArticleFactory(db).create({
        authorId: adminUser.id,
        title: "MCP hidden draft article",
        status: "draft",
      });
      draftArticleId = draftArticle.id;
      const draftNews = await createNewsFactory(db).create({
        authorId: adminUser.id,
        title: "MCP hidden draft news",
        status: "draft",
      });
      draftNewsId = draftNews.id;
      const qa = await createQAFactory(db).create({
        title: "MCP learner question",
        description: "<p>A learner-visible answer</p>",
      });
      qaId = qa.id;
      await app.get(SearchIndexService).refreshCourse(publishedCourse.id);
      await app.get(SearchIndexService).refreshArticle(draftArticle.id);
      await app.get(SearchIndexService).refreshNews(draftNews.id);
      await app.get(SearchIndexService).refreshQA(qa.id);

      await app.get(SearchIndexService).refreshArticle(article.id);
      await app.get(SearchIndexService).refreshNews(news.id);
      const course = await createCourseFactory(db).create({
        authorId: adminUser.id,
        title: "MCP localized hidden course",
        status: "draft",
        thumbnailS3Key: null,
      });
      draftCourseId = course.id;
      await db
        .update(courses)
        .set({
          title: buildJsonbFieldWithMultipleEntries({
            en: "MCP localized hidden course",
            pl: "Szkolenie ukryte MCP",
          }),
          availableLocales: ["en", "pl"],
        })
        .where(eq(courses.id, course.id));
      await app.get(SearchIndexService).refreshCourse(course.id);
      return { adminUser, studentUser };
    });
    await baseDb
      .update(settings)
      .set({
        settings: settingsToJSONBuildObject({
          ...DEFAULT_E2E_GLOBAL_SETTINGS,
          articlesEnabled: true,
          newsEnabled: true,
          QAEnabled: true,
        }),
      })
      .where(and(eq(settings.tenantId, setup.defaultTenantId), isNull(settings.userId)));
    const foreignUser = await runAsTenant(secondTenant.id, async () => {
      await createSettingsFactory(db).create();
      return factory
        .withAdminSettings(db)
        .create({ tenantId: secondTenant.id, roleSlug: SYSTEM_ROLE_SLUGS.ADMIN });
    });
    admin = await issueClient(first.adminUser, host);
    const login = await http("/api/auth/login").send({
      email: first.adminUser.email,
      password: "Mcp-Test-Password123!",
    });
    if (login.status !== 201)
      throw new Error(`Fixture login ${login.status}: ${JSON.stringify(login.body)}`);
    const cookies = login.headers["set-cookie"];
    if (!cookies?.length) throw new Error("Fixture login returned no auth cookies");
    const cookieHeaders = Array.isArray(cookies) ? cookies : [cookies];
    adminCookie = cookieHeaders.map((cookie) => cookie.split(";", 1)[0]).join("; ");
    student = await issueClient(first.studentUser, host);
    foreign = await issueClient(foreignUser, foreignHost);
    png = await sharp({ create: { width: 32, height: 32, channels: 4, background: "#2870a0" } })
      .png()
      .toBuffer();
  }, 120000);

  afterAll(async () => {
    if (app) await app.close();
    if (originalRateLimiting === undefined) delete process.env.DISABLE_RATE_LIMITING;
    else process.env.DISABLE_RATE_LIMITING = originalRateLimiting;
  }, 30000);

  it("initializes the protocol and lists authorized tools with lifecycle exclusions", async () => {
    const initialized = await rpc(admin, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "integration", version: "1" },
    });
    expect(initialized.result.serverInfo.name).toBe("mentingo");
    const tools = (await rpc(admin, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual(
      expect.arrayContaining([
        "list_users",
        "update_user",
        "create_group",
        "global_search",
        "request_platform_image_upload",
        "request_my_avatar_upload",
        "request_generic_file_upload",
      ]),
    );
    expect(tools).not.toEqual(expect.arrayContaining(["create_user"]));
    for (const excluded of [
      "create_user",
      "import_users",
      "delete_user",
      "archive_users",
      "delete_group",
      "delete_groups",
    ])
      expect(tools).not.toContain(excluded);
  });

  it("filters discovery for a learner and rejects cross-tenant access tokens", async () => {
    const tools = (await rpc(student, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toContain("get_my_user");
    expect(tools).not.toContain("update_user");
    expect(tools).not.toContain("request_platform_image_upload");
    await rejectedCall("update_user", { userId: target.id, firstName: "Denied" }, student);
    await http("/api/mcp", "post", foreign)
      .set("Authorization", `Bearer ${admin.token}`)
      .set("Accept", "application/json, text/event-stream")
      .send({ jsonrpc: "2.0", id: ++seq, method: "tools/list" })
      .expect(401);
  });

  it.each([MCP_SCOPES.SEARCH, MCP_SCOPES.SEARCH_READ])(
    "restricts an administrator's %s token to global search at discovery and invocation",
    async (scope) => {
      const search = await issueClient(admin.user, admin.host, [scope]);
      const tools = (await rpc(search, "tools/list")).result.tools.map(
        (tool: ToolResult) => tool.name,
      );
      expect(tools).toEqual(["global_search"]);
      // Explicit calls cannot regain the administrator's broader account permissions.
      await rejectedCall("create_course", { title: "Forbidden search scope course" }, search);
      await rejectedCall("list_users", {}, search);
      await rejectedCall("get_lesson", { lessonId: randomUUID() }, search);
      await rejectedCall("get_my_capabilities", {}, search);

      const authoringTools = (await rpc(admin, "tools/list")).result.tools.map(
        (tool: ToolResult) => tool.name,
      );
      expect(authoringTools).toEqual(
        expect.arrayContaining(["global_search", "create_course", "list_users", "get_lesson"]),
      );
    },
  );

  it("keeps explicit search:read responses account-permission filtered", async () => {
    const search = await issueClient(admin.user, admin.host, [MCP_SCOPES.SEARCH_READ]);
    const result = await call("global_search", { searchQuery: "MCP", language: "en" }, search);
    expect(result).toHaveProperty("lessons");
    expect(result.allCourses).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draftCourseId })]),
    );
    await rejectedCall("list_courses", {}, search);
  });

  it("uses the same read tool names for a general student account without granting management access", async () => {
    const tools = (await rpc(student, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual(
      expect.arrayContaining(["list_courses", "get_course", "list_articles", "get_article"]),
    );
    expect(tools).not.toEqual(expect.arrayContaining(["create_course", "list_users"]));
    expect(tools.some((name: string) => name.includes("student"))).toBe(false);
    const course = await call(
      "get_course",
      { courseId: publishedCourseId, language: "en" },
      student,
    );
    expect(course.course).toEqual(expect.objectContaining({ id: publishedCourseId }));
    expect(course.course).not.toHaveProperty("revision");
    await rejectedCall("get_course", { courseId: draftCourseId, language: "en" }, student);
  });

  it("keeps an explicit course read grant from mutating content", async () => {
    const reader = await issueClient(admin.user, admin.host, [MCP_SCOPES.COURSES_READ]);
    const tools = (await rpc(reader, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual(expect.arrayContaining(["list_courses", "get_course"]));
    expect(tools).not.toContain("create_course");
    const course = await call("get_course", { courseId: draftCourseId, language: "en" }, reader);
    expect(course).toEqual(expect.objectContaining({ id: draftCourseId, status: "draft" }));
    await rejectedCall("create_course", { title: "Forbidden read scope course" }, reader);
  });

  it("executes all learner list/get tools without exposing an administrator's drafts or authoring data", async () => {
    const reader = await issueClient(admin.user, admin.host, [MCP_SCOPES.STUDENT_READ]);
    const tools = (await rpc(reader, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools.sort()).toEqual(
      [
        "global_search",
        "list_courses",
        "get_course",
        "list_articles",
        "get_article",
        "list_news",
        "get_news",
        "list_qa_entries",
        "get_qa_entry",
        "list_chapters",
        "get_chapter",
        "list_lessons",
        "get_lesson",
        "search_lessons",
      ].sort(),
    );
    const courseList = await call("list_courses", { language: "en", scope: "available" }, reader);
    expect(courseList.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: publishedCourseId })]),
    );
    expect(courseList.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: draftCourseId })]),
    );
    const course = await call(
      "get_course",
      { courseId: publishedCourseId, language: "en" },
      reader,
    );
    expect(course.course).toEqual(
      expect.objectContaining({
        id: publishedCourseId,
        url: `http://${admin.host}/course/${publishedCourseId}`,
      }),
    );
    for (const field of ["lessons", "chapters", "resources", "revision", "status", "authorId"])
      expect(course.course).not.toHaveProperty(field);
    await rejectedCall("get_course", { courseId: draftCourseId, language: "en" }, reader);
    for (const [listTool, getTool, id, hiddenId, key] of [
      ["list_articles", "get_article", articleId, draftArticleId, "article"],
      ["list_news", "get_news", newsId, draftNewsId, "news"],
      ["list_qa_entries", "get_qa_entry", qaId, undefined, "qa"],
    ] as const) {
      const listed = await call(listTool, { language: "en" }, reader);
      expect(listed.data).toEqual(expect.arrayContaining([expect.objectContaining({ id })]));
      if (hiddenId) {
        expect(listed.data).not.toEqual(
          expect.arrayContaining([expect.objectContaining({ id: hiddenId })]),
        );
        await rejectedCall(getTool, { id: hiddenId, language: "en" }, reader);
      }
      const detailArgs =
        getTool === "get_qa_entry" ? { qaId: id, language: "en" } : { id, language: "en" };
      const detail = await call(getTool, detailArgs, reader);
      expect(detail[key]).toEqual(expect.objectContaining({ id }));
      expect(detail[key]).not.toHaveProperty("resources");
    }
    const result = await call("global_search", { searchQuery: "MCP", language: "en" }, reader);
    expect(result.lessons).toEqual([]);
    for (const excluded of ["users", "groups", "categories", "learningPaths"])
      expect(result).not.toHaveProperty(excluded);
    expect(JSON.stringify(result)).not.toContain(draftCourseId);
    expect(JSON.stringify(result)).not.toContain(draftArticleId);
    expect(JSON.stringify(result)).not.toContain(draftNewsId);
    await rejectedCall("create_course", { title: "Forbidden" }, reader);
    const otherReader = await issueClient(foreign.user, foreign.host, [MCP_SCOPES.STUDENT_READ]);
    await rejectedCall("get_article", { id: articleId, language: "en" }, otherReader);
  });

  describe("student-scope lesson reading", () => {
    async function curriculum(
      owner = admin,
      status:
        | typeof COURSE_STATUSES.PUBLISHED
        | typeof COURSE_STATUSES.PRIVATE = COURSE_STATUSES.PUBLISHED,
    ) {
      const marker = `curriculum-${randomUUID()}`;
      return runAsTenant(owner.tenantId, async () => {
        const course = await createCourseFactory(db).create({
          authorId: owner.user.id,
          title: `Course ${marker}`,
          status,
          priceInCents: 0,
          isArchived: false,
          thumbnailS3Key: null,
        });
        const chapter = await createChapterFactory(db).create({
          courseId: course.id,
          authorId: owner.user.id,
          title: `Chapter ${marker}`,
          displayOrder: 1,
          isFreemium: false,
          lessonCount: 1,
        });
        const lesson = await createLessonFactory(db).create({
          chapterId: chapter.id,
          title: { en: "Learner content" },
          description: {
            en: `<p>Visible authored body ${marker}</p><script>scriptsecret-${marker}</script><img alt="quoted > hiddenattribute-${marker}" src="https://private.invalid/attribute-${marker}"><script>unclosedscript-${marker}`,
          },
        });
        return {
          marker,
          course,
          chapter,
          lesson,
          args: { courseId: course.id, chapterId: chapter.id, lessonId: lesson.id, language: "en" },
        };
      });
    }

    async function indexLesson(fixture: Awaited<ReturnType<typeof curriculum>>, owner = admin) {
      await runAsTenant(owner.tenantId, async () => {
        await app.get(SearchIndexService).refreshLesson(fixture.lesson.id);
        const index = app.get(SemanticSearchIndexRepository);
        const docs = await db
          .select()
          .from(searchDocuments)
          .where(eq(searchDocuments.entityId, fixture.lesson.id));
        for (const doc of docs) {
          const source = await index.findSource({
            entityType: doc.entityType,
            entityId: doc.entityId,
            documentType: doc.documentType,
            language: doc.language,
          });
          if (!source) continue;
          const chunks = chunkSearchText(normalizeSearchText(source.content));
          if (chunks.length)
            await index.replace(
              source,
              chunks,
              chunks.map(() => [1, ...Array<number>(1535).fill(0)]),
            );
        }
      });
    }

    it("globally finds authorized lessons in keyword and hybrid modes then reads them by result identity", async () => {
      const visible = await curriculum();
      const enrolledOnly = await curriculum(admin, COURSE_STATUSES.PRIVATE);
      const hidden = await curriculum();
      const foreignLesson = await curriculum(foreign);
      await baseDb
        .update(courses)
        .set({ status: COURSE_STATUSES.DRAFT })
        .where(eq(courses.id, hidden.course.id));
      for (const fixture of [visible, enrolledOnly, hidden]) await indexLesson(fixture);
      await indexLesson(foreignLesson, foreign);
      const embed = jest
        .spyOn(app.get(SemanticSearchEmbeddingService), "embedQuery")
        .mockResolvedValue([1, ...Array<number>(1535).fill(0)]);
      try {
        for (const reader of await readers()) {
          for (const mode of ["keyword", "hybrid"]) {
            const found = await call(
              "global_search",
              { searchQuery: "Visible authored body", language: "en", mode },
              reader,
            );
            expect(found.lessons).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ id: visible.lesson.id, courseId: visible.course.id }),
              ]),
            );
            for (const fixture of [enrolledOnly, hidden, foreignLesson])
              expect(found.lessons.map((row: ToolResult) => row.id)).not.toContain(
                fixture.lesson.id,
              );
            const hit = found.lessons.find((row: ToolResult) => row.id === visible.lesson.id);
            expect(Object.keys(hit).sort()).toEqual(
              ["id", "title", "courseId", "matchedPassage", "url"].sort(),
            );
            const detail = await call(
              "get_lesson",
              { courseId: hit.courseId, lessonId: hit.id, language: "en" },
              reader,
            );
            expect(detail.lesson.content).toContain(visible.marker);
            expect(found).not.toHaveProperty("users");
            expect(found).not.toHaveProperty("learningPaths");
          }
          await runAsTenant(reader.tenantId, async () =>
            db.insert(studentCourses).values({
              studentId: reader.user.id,
              courseId: enrolledOnly.course.id,
              status: COURSE_ENROLLMENT.ENROLLED,
            }),
          );
          const enrolled = await call(
            "global_search",
            { searchQuery: "Visible authored body", language: "en", mode: "hybrid" },
            reader,
          );
          expect(enrolled.lessons.map((row: ToolResult) => row.id)).toContain(
            enrolledOnly.lesson.id,
          );
          await runAsTenant(reader.tenantId, async () =>
            db
              .update(studentCourses)
              .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
              .where(
                and(
                  eq(studentCourses.studentId, reader.user.id),
                  eq(studentCourses.courseId, enrolledOnly.course.id),
                ),
              ),
          );
          const revoked = await call(
            "global_search",
            { searchQuery: "Visible authored body", language: "en", mode: "hybrid" },
            reader,
          );
          expect(revoked.lessons.map((row: ToolResult) => row.id)).not.toContain(
            enrolledOnly.lesson.id,
          );
          for (const query of [
            `scriptsecret-${visible.marker}`,
            `hiddenattribute-${visible.marker}`,
            `unclosedscript-${visible.marker}`,
          ]) {
            const noHiddenMatches = await call(
              "global_search",
              { searchQuery: query, language: "en", mode: "keyword" },
              reader,
            );
            expect(noHiddenMatches.lessons).toEqual([]);
          }
        }
        const legacy = await issueClient(admin.user, admin.host, [MCP_SCOPES.SEARCH]);
        const legacyResults = await call(
          "global_search",
          { searchQuery: "Visible authored body", language: "en" },
          legacy,
        );
        expect(legacyResults).not.toHaveProperty("lessons");
      } finally {
        embed.mockRestore();
      }
    });

    async function readers() {
      return [
        await issueClient(admin.user, admin.host, [MCP_SCOPES.STUDENT_READ]),
        await issueClient(student.user, student.host, [MCP_SCOPES.STUDENT_READ]),
      ];
    }

    async function assertUnavailable(
      fixture: Awaited<ReturnType<typeof curriculum>>,
      reader: Client,
    ) {
      const { lessonId: _lessonId, ...listArgs } = fixture.args;
      expect(
        (await call("list_chapters", { courseId: fixture.course.id, language: "en" }, reader))
          .chapters,
      ).toEqual([]);
      const listed = await call("list_lessons", listArgs, reader);
      expect(listed.data).toEqual([]);
      expect(listed.pagination.totalItems).toBe(0);
      const searched = await call(
        "search_lessons",
        { query: fixture.marker, language: "en" },
        reader,
      );
      expect(searched.data).toEqual([]);
      expect(searched.pagination.totalItems).toBe(0);
      await rejectedCall("get_lesson", fixture.args, reader);
    }

    it("lets learner and admin readers enumerate and search unenrolled free public content without starting lessons or exposing quiz answers", async () => {
      const fixture = await curriculum();
      const quizSecret = `correct-answer-${randomUUID()}`;
      const quiz = await runAsTenant(admin.tenantId, async () => {
        const lesson = await createLessonFactory(db).create({
          chapterId: fixture.chapter.id,
          type: LESSON_TYPES.QUIZ,
          thresholdScore: 50,
          title: { en: "Learner quiz" },
          description: { en: quizSecret },
          displayOrder: 2,
        });
        const [assessment] = await db
          .insert(assessments)
          .values({ lessonId: lesson.id, passingScorePercentage: "50" })
          .returning();
        const [question] = await db
          .insert(assessmentQuestions)
          .values({
            assessmentId: assessment.id,
            questionType: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            gradingMode: ASSESSMENT_GRADING_MODES.AUTOMATIC,
            displayOrder: 1,
            prompt: { en: "Which answer?" },
          })
          .returning();
        await db.insert(assessmentQuestionChoiceOptions).values({
          questionId: question.id,
          language: "en",
          displayOrder: 1,
          isCorrect: true,
          label: quizSecret,
        });
        return lesson;
      });
      for (const reader of await readers()) {
        const chapters = await call(
          "list_chapters",
          { courseId: fixture.course.id, language: "en" },
          reader,
        );
        expect(chapters.chapters).toEqual([expect.objectContaining({ id: fixture.chapter.id })]);
        const listed = await call(
          "list_lessons",
          {
            courseId: fixture.course.id,
            chapterId: fixture.chapter.id,
            language: "en",
            pageSize: 1,
          },
          reader,
        );
        expect(listed.data).toEqual([expect.objectContaining({ id: fixture.lesson.id })]);
        expect(listed.pagination.totalItems).toBe(2);
        const detail = await call("get_lesson", fixture.args, reader);
        expect(detail.lesson.content).toContain(`Visible authored body ${fixture.marker}`);
        expect(JSON.stringify(detail)).not.toContain("scriptsecret");
        expect(JSON.stringify(detail)).not.toContain("private.invalid");
        const found = await call(
          "search_lessons",
          { query: fixture.marker, language: "en" },
          reader,
        );
        expect(found.data).toEqual([expect.objectContaining({ id: fixture.lesson.id })]);
        for (const query of [
          `scriptsecret-${fixture.marker}`,
          `attribute-${fixture.marker}`,
          `hiddenattribute-${fixture.marker}`,
          `unclosedscript-${fixture.marker}`,
          quizSecret,
        ]) {
          expect((await call("search_lessons", { query, language: "en" }, reader)).data).toEqual(
            [],
          );
        }
        const quizRead = await call("get_lesson", { ...fixture.args, lessonId: quiz.id }, reader);
        expect(quizRead.lesson).toEqual(
          expect.objectContaining({ content: "", contentReadSupported: false }),
        );
        expect(JSON.stringify(quizRead)).not.toContain(quizSecret);
        await runAsTenant(reader.tenantId, async () => {
          expect(
            await db
              .select()
              .from(studentLessonProgress)
              .where(
                and(
                  eq(studentLessonProgress.studentId, reader.user.id),
                  inArray(studentLessonProgress.lessonId, [fixture.lesson.id, quiz.id]),
                ),
              ),
          ).toEqual([]);
          expect(
            await db
              .select()
              .from(studentCourses)
              .where(
                and(
                  eq(studentCourses.studentId, reader.user.id),
                  eq(studentCourses.courseId, fixture.course.id),
                ),
              ),
          ).toEqual([]);
        });
      }
    });

    it("gives normal student account access the same free and enrolled lesson reads and search", async () => {
      const reader = await issueClient(student.user, student.host, [MCP_SCOPES.ACCOUNT_ACCESS]);
      const free = await curriculum();
      const paid = await curriculum();
      const privateCourse = await curriculum(admin, COURSE_STATUSES.PRIVATE);
      await baseDb
        .update(courses)
        .set({ priceInCents: 1500 })
        .where(eq(courses.id, paid.course.id));
      for (const fixture of [free, paid, privateCourse]) await indexLesson(fixture);
      const embed = jest
        .spyOn(app.get(SemanticSearchEmbeddingService), "embedQuery")
        .mockResolvedValue([1, ...Array<number>(1535).fill(0)]);
      try {
        const tools = (await rpc(reader, "tools/list")).result.tools.map(
          (tool: ToolResult) => tool.name,
        );
        expect(tools).toEqual(
          expect.arrayContaining([
            "list_chapters",
            "get_chapter",
            "list_lessons",
            "get_lesson",
            "search_lessons",
          ]),
        );
        expect(tools).not.toContain("create_course");
        expect((await call("get_lesson", free.args, reader)).lesson.content).toContain(free.marker);
        for (const fixture of [paid, privateCourse]) await assertUnavailable(fixture, reader);
        for (const mode of ["keyword", "hybrid"]) {
          const result = await call(
            "global_search",
            { searchQuery: "Visible authored body", language: "en", mode },
            reader,
          );
          const ids = result.lessons.map((row: ToolResult) => row.id);
          expect(ids).toContain(free.lesson.id);
          for (const fixture of [paid, privateCourse]) expect(ids).not.toContain(fixture.lesson.id);
        }
        await runAsTenant(reader.tenantId, async () =>
          db.insert(studentCourses).values(
            [paid, privateCourse].map((fixture) => ({
              courseId: fixture.course.id,
              studentId: reader.user.id,
              status: COURSE_ENROLLMENT.ENROLLED,
            })),
          ),
        );
        for (const fixture of [paid, privateCourse])
          expect((await call("get_lesson", fixture.args, reader)).lesson.content).toContain(
            fixture.marker,
          );
        for (const mode of ["keyword", "hybrid"]) {
          const result = await call(
            "global_search",
            { searchQuery: "Visible authored body", language: "en", mode },
            reader,
          );
          const ids = result.lessons.map((row: ToolResult) => row.id);
          for (const fixture of [free, paid, privateCourse])
            expect(ids).toContain(fixture.lesson.id);
        }
        await runAsTenant(reader.tenantId, async () =>
          db
            .update(studentCourses)
            .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
            .where(
              and(
                eq(studentCourses.studentId, reader.user.id),
                inArray(studentCourses.courseId, [paid.course.id, privateCourse.course.id]),
              ),
            ),
        );
        for (const fixture of [paid, privateCourse]) await assertUnavailable(fixture, reader);
        const revoked = await call(
          "global_search",
          { searchQuery: "Visible authored body", language: "en", mode: "hybrid" },
          reader,
        );
        for (const fixture of [paid, privateCourse])
          expect(revoked.lessons.map((row: ToolResult) => row.id)).not.toContain(fixture.lesson.id);
      } finally {
        embed.mockRestore();
      }
    });

    it("requires own active enrollment for paid public lessons, including admin student scope", async () => {
      const fixture = await curriculum();
      // Exercise enrollment authorization with authored words, not UUID tokenization.
      const searchQuery = "Visible authored body";
      await baseDb
        .update(courses)
        .set({ priceInCents: 1500 })
        .where(eq(courses.id, fixture.course.id));
      await indexLesson(fixture);
      const embed = jest
        .spyOn(app.get(SemanticSearchEmbeddingService), "embedQuery")
        .mockResolvedValue([1, ...Array<number>(1535).fill(0)]);
      try {
        for (const reader of await readers()) {
          await assertUnavailable(fixture, reader);
          for (const mode of ["keyword", "hybrid"]) {
            const result = await call(
              "global_search",
              { searchQuery, language: "en", mode },
              reader,
            );
            expect(result.lessons.map((row: ToolResult) => row.id)).not.toContain(
              fixture.lesson.id,
            );
          }
          await runAsTenant(reader.tenantId, async () =>
            db.insert(studentCourses).values({
              courseId: fixture.course.id,
              studentId: reader.user.id,
              status: COURSE_ENROLLMENT.ENROLLED,
            }),
          );
          expect((await call("get_lesson", fixture.args, reader)).lesson.content).toContain(
            fixture.marker,
          );
          for (const mode of ["keyword", "hybrid"]) {
            const result = await call(
              "global_search",
              { searchQuery, language: "en", mode },
              reader,
            );
            expect(result.lessons.map((row: ToolResult) => row.id)).toContain(fixture.lesson.id);
          }
          await runAsTenant(reader.tenantId, async () =>
            db
              .update(studentCourses)
              .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
              .where(
                and(
                  eq(studentCourses.courseId, fixture.course.id),
                  eq(studentCourses.studentId, reader.user.id),
                ),
              ),
          );
          await assertUnavailable(fixture, reader);
          const revoked = await call(
            "global_search",
            { searchQuery, language: "en", mode: "hybrid" },
            reader,
          );
          expect(revoked.lessons.map((row: ToolResult) => row.id)).not.toContain(fixture.lesson.id);
        }
      } finally {
        embed.mockRestore();
      }
    });

    it("requires each reader's own active enrollment for private lessons and denies reads immediately after revocation", async () => {
      const fixture = await curriculum(admin, COURSE_STATUSES.PRIVATE);
      await runAsTenant(admin.tenantId, async () => {
        await db.insert(studentCourses).values({
          courseId: fixture.course.id,
          studentId: target.id,
          status: COURSE_ENROLLMENT.ENROLLED,
        });
      });
      for (const reader of await readers()) {
        await assertUnavailable(fixture, reader);
        await runAsTenant(reader.tenantId, async () => {
          await db.insert(studentCourses).values({
            courseId: fixture.course.id,
            studentId: reader.user.id,
            status: COURSE_ENROLLMENT.ENROLLED,
          });
        });
        expect((await call("get_lesson", fixture.args, reader)).lesson.id).toBe(fixture.lesson.id);
        expect(
          (await call("search_lessons", { query: fixture.marker, language: "en" }, reader)).data,
        ).toEqual([expect.objectContaining({ id: fixture.lesson.id })]);
        await runAsTenant(reader.tenantId, async () => {
          await db
            .update(studentCourses)
            .set({ status: COURSE_ENROLLMENT.NOT_ENROLLED })
            .where(
              and(
                eq(studentCourses.courseId, fixture.course.id),
                eq(studentCourses.studentId, reader.user.id),
              ),
            );
        });
        await assertUnavailable(fixture, reader);
      }
    });

    it("denies draft, archived and foreign tenant lessons even to the course author with student scope", async () => {
      const fixture = await curriculum();
      const scopedReaders = await readers();
      await runAsTenant(admin.tenantId, async () => {
        await db.insert(studentCourses).values(
          scopedReaders.map((reader) => ({
            courseId: fixture.course.id,
            studentId: reader.user.id,
            status: COURSE_ENROLLMENT.ENROLLED,
          })),
        );
        await db
          .update(courses)
          .set({ status: COURSE_STATUSES.DRAFT })
          .where(eq(courses.id, fixture.course.id));
      });
      for (const reader of scopedReaders) await assertUnavailable(fixture, reader);
      await runAsTenant(admin.tenantId, async () => {
        await db
          .update(courses)
          .set({ status: COURSE_STATUSES.PUBLISHED, isArchived: true })
          .where(eq(courses.id, fixture.course.id));
      });
      for (const reader of scopedReaders) await assertUnavailable(fixture, reader);
      const foreignFixture = await curriculum(foreign);
      for (const reader of scopedReaders) await assertUnavailable(foreignFixture, reader);
      const foreignReader = await issueClient(foreign.user, foreign.host, [
        MCP_SCOPES.STUDENT_READ,
      ]);
      expect((await call("get_lesson", foreignFixture.args, foreignReader)).lesson.id).toBe(
        foreignFixture.lesson.id,
      );
    });
  });

  it("preserves the frozen management catalog for an existing legacy authoring grant", async () => {
    const legacy = await issueClient(admin.user, admin.host, [MCP_SCOPES.AUTHORING]);
    const tools = (await rpc(legacy, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual(
      expect.arrayContaining(["global_search", "create_course", "get_course", "list_users"]),
    );
    expect(tools.some((name: string) => name.includes("student"))).toBe(false);
    const draft = await call("get_course", { courseId: draftCourseId, language: "en" }, legacy);
    expect(draft).toEqual(expect.objectContaining({ id: draftCourseId, status: "draft" }));
  });

  it("preserves canonical content-only links for an existing legacy search grant", async () => {
    const search = await issueClient(admin.user, admin.host, [MCP_SCOPES.SEARCH]);
    const result = await call("global_search", { searchQuery: "MCP", language: "en" }, search);
    for (const excluded of ["lessons", "users", "groups", "categories", "learningPaths"])
      expect(result).not.toHaveProperty(excluded);
    expect(result.allCourses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: draftCourseId,
          url: `http://${admin.host}/course/${draftCourseId}`,
        }),
      ]),
    );
    expect(result.articles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: articleId,
          url: `http://${admin.host}/articles/${articleId}`,
        }),
      ]),
    );
    expect(result.news).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: newsId, url: `http://${admin.host}/news/${newsId}` }),
      ]),
    );
    for (const group of ["allCourses", "myCourses", "availableCourses"])
      for (const course of result[group]) {
        expect(course).not.toHaveProperty("matchedPassage");
        expect(course).not.toHaveProperty("matchedAttachmentFileName");
      }
    expect(JSON.stringify(result)).not.toContain(target.email);
    expect(JSON.stringify(result)).not.toContain(foreign.host);
  });

  it("rechecks current permissions for a search token instead of granting search access by scope", async () => {
    const extra = await runAsTenant(admin.tenantId, () =>
      createUserFactory(db)
        .withAdminSettings(db)
        .create({ tenantId: admin.tenantId, roleSlug: SYSTEM_ROLE_SLUGS.ADMIN }),
    );
    const search = await issueClient(extra, admin.host, [MCP_SCOPES.SEARCH_READ]);
    await baseDb.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, extra.id));
    const tools = (await rpc(search, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual([]);
    await rejectedCall("global_search", { searchQuery: "MCP", language: "en" }, search);
  });

  it("reads and updates existing users while rejecting archive and creation inputs", async () => {
    const before = await call("get_user", { userId: target.id });
    expect(before.email).toBe(target.email);
    expect(JSON.stringify(before)).not.toMatch(/passwordHash|tokenHash|MFASecret/);
    await call("update_user", { userId: target.id, firstName: "MCP updated person" });
    expect((await call("get_user", { userId: target.id })).firstName).toBe("MCP updated person");
    await rejectedCall("update_user", { userId: target.id, archived: true });
    await rejectedCall("create_user", { email: "forbidden@example.com" });
    await rejectedCall("get_user", { userId: foreign.user.id });
    const [stored] = await baseDb.select().from(users).where(eq(users.id, target.id));
    expect(stored.archived).toBe(false);
    expect(stored.deletedAt).toBeNull();
  });

  it("creates and translates groups, sets membership and never exposes group deletion", async () => {
    const group = await call("create_group", {
      name: "MCP team",
      characteristic: "Original",
      language: "en",
      idempotencyKey: randomUUID(),
    });
    await call("add_group_language", { groupId: group.id, language: "pl" });
    await call("update_group", {
      groupId: group.id,
      name: "Zespół MCP",
      characteristic: "Polska",
      language: "pl",
    });
    expect((await call("get_group", { groupId: group.id, language: "pl" })).name).toBe(
      "Zespół MCP",
    );
    await call("set_group_base_language", { groupId: group.id, baseLanguage: "pl" });
    await call("set_user_groups", { userId: target.id, groupIds: [group.id] });
    const membership = await baseDb
      .select()
      .from(groupUsers)
      .where(eq(groupUsers.userId, target.id));
    expect(membership.map((item) => item.groupId)).toContain(group.id);
    await call("remove_group_language", {
      groupId: group.id,
      language: "en",
      confirmLanguage: "en",
    });
    await rejectedCall("delete_group", { groupId: group.id });
    const [stored] = await baseDb.select().from(groups).where(eq(groups.id, group.id));
    expect(stored.availableLocales).toEqual(["pl"]);
  });

  it("globally searches localized content with learner and tenant access boundaries", async () => {
    const result = await call("global_search", { searchQuery: "Szkolenie", language: "pl" });
    expect(result.allCourses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: draftCourseId, title: "Szkolenie ukryte MCP" }),
      ]),
    );
    const learner = await call(
      "global_search",
      { searchQuery: "Szkolenie", language: "pl" },
      student,
    );
    expect(JSON.stringify(learner)).not.toContain(draftCourseId);
    expect(learner).not.toHaveProperty("users");
    const other = await call(
      "global_search",
      { searchQuery: "Szkolenie", language: "pl" },
      foreign,
    );
    expect(JSON.stringify(other)).not.toContain(draftCourseId);
  });

  it("updates branding colors and stores a real logo through returned multipart instructions", async () => {
    await call("update_platform_colors", { primaryColor: "#123456", contrastColor: "#ffffff" });
    const grant = await imageGrant();
    expect(grant.uploadRequest.url).toBe(`http://${admin.host}/api/settings/platform-logo`);
    await upload(grant, png).expect(200);
    const platform = await call("get_platform_customization");
    expect(platform.settings.primaryColor).toBe("#123456");
    expect(platform.settings.platformLogoS3Key).toContain(admin.tenantId);
    expect(platform.platformLogoUrl).toBeTruthy();
    expect(platform.settings.enforceSSO).toBeUndefined();
    await upload(grant, png).expect(401);
  });

  it("stores the learner's avatar and refuses profile fields bundled with an avatar grant", async () => {
    const args = { filename: "asset.png", mimeType: "image/png", size: png.length };
    const bad = await call("request_my_avatar_upload", args, student);
    await upload(bad, png, {
      client: student,
      fields: { data: '{"firstName":"Injected"}' },
    }).expect(403);
    const grant = await call("request_my_avatar_upload", args, student);
    expect(grant.uploadRequest.fields).toEqual({ data: "{}" });
    await upload(grant, png, { client: student }).expect(200);
    const [stored] = await baseDb.select().from(users).where(eq(users.id, student.user.id));
    expect(stored.avatarReference).toContain(student.tenantId);
    expect(stored.firstName).toBe(student.user.firstName);
  });

  it("stores a public PDF login document and resolves the persisted resource ID", async () => {
    const grant = await call("request_platform_login_document_upload", {
      name: "MCP policy",
      filename: "policy.pdf",
      mimeType: "application/pdf",
      size: pdf.length,
    });
    await upload(grant, pdf).expect(200);
    const listed = await call("list_platform_login_documents");
    expect(listed.documents.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "MCP policy",
          id: expect.any(String),
          resourceUrl: expect.any(String),
        }),
      ]),
    );
  });

  it("rejects changed upload routes and methods without consuming a valid grant", async () => {
    const grant = await imageGrant();
    await upload(grant, png, { path: "/api/settings/platform-simple-logo" }).expect(401);
    await upload(grant, png, { method: "post" }).expect(404);
    await upload(grant, png).expect(200);
  });

  it("rejects changed filenames, sizes, MIME declarations and unrelated multipart fields", async () => {
    await upload(await imageGrant(), png, { filename: "other.png" }).expect(403);
    await upload(await imageGrant(), Buffer.concat([png, Buffer.from("extra")])).expect(403);
    await upload(await imageGrant(), png, { mimeType: "image/jpeg" }).expect(403);
    await upload(await imageGrant(), png, { fields: { enforceSSO: "true" } }).expect(403);
  });

  it("checks detected bytes and tenant host before writing an asset", async () => {
    const spoofed = await call("request_platform_image_upload", {
      kind: "platformLogo",
      filename: "asset.png",
      mimeType: "image/png",
      size: pdf.length,
    });
    await upload(spoofed, pdf).expect(400);
    const grant = await imageGrant();
    await upload(grant, png, { client: foreign }).expect(401);
    await upload(grant, png).expect(200);
  });

  it.each(["articles", "news"] as const)(
    "uploads and inserts real resource IDs into complete %s content with revision checks",
    async (resource) => {
      const id = resource === "articles" ? articleId : newsId;
      const readTool = resource === "articles" ? "get_article" : "get_news";
      const updateTool = resource === "articles" ? "update_article" : "update_news";
      const grant = await call("request_generic_file_upload", {
        resource,
        targetId: id,
        language: "en",
        filename: "editorial.png",
        mimeType: "image/png",
        size: png.length,
      });
      const response = await upload(grant, png).expect(201);
      const resourceId = response.body.data.resourceId;
      expect(resourceId).toEqual(expect.any(String));
      const current = await call(readTool, { id, language: "en" });
      const node = grant.contentInsertion.htmlTemplates.preview.replaceAll(
        "{resourceId}",
        resourceId,
      );
      expect(node).toContain(`/api/${resource}/${resource}-resource/${resourceId}`);
      await call(updateTool, {
        id,
        language: "en",
        expectedRevision: current.revision,
        content: `${current.content}${node}`,
      });
      const updated = await call(readTool, { id, language: "en" });
      expect(updated.content).toContain(resourceId);
      const nativeRead = await http(`/api/${resource}/${id}?language=en`, "get")
        .set("Cookie", adminCookie)
        .expect(200);
      expect(JSON.stringify(nativeRead.body)).toContain(resourceId);
      await http(`/api/${resource}/${resource}-resource/${resourceId}`, "get")
        .set("Cookie", adminCookie)
        .expect(200)
        .expect("Content-Type", /image\/webp/);
      expect(updated.content).toContain(
        resource === "articles" ? "Keep article body" : "Keep news body",
      );
      const links = await baseDb
        .select()
        .from(resourceEntity)
        .where(eq(resourceEntity.resourceId, resourceId));
      expect(links).toEqual(expect.arrayContaining([expect.objectContaining({ entityId: id })]));
      await rejectedCall(updateTool, {
        id,
        language: "en",
        expectedRevision: current.revision,
        title: "Stale revision",
      });
    },
  );

  it("rechecks tool and upload permissions after an access token was issued", async () => {
    const extra = await runAsTenant(admin.tenantId, () =>
      createUserFactory(db)
        .withAdminSettings(db)
        .create({ tenantId: admin.tenantId, roleSlug: SYSTEM_ROLE_SLUGS.ADMIN }),
    );
    const client = await issueClient(extra, admin.host);
    const grant = await imageGrant(client);
    await baseDb.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, extra.id));
    await rejectedCall(
      "update_platform_colors",
      { primaryColor: "#abcdef", contrastColor: "#ffffff" },
      client,
    );
    await upload(grant, png, { client }).expect(403);
    const tools = (await rpc(client, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).not.toContain("update_platform_colors");
  });
});
