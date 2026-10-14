import { randomUUID } from "node:crypto";

import { SYSTEM_ROLE_SLUGS, TENANT_STATUSES } from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import request from "supertest";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { SearchIndexService } from "src/global-search/search-index.service";
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
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createArticleFactory } from "../../../test/factory/article.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createNewsFactory } from "../../../test/factory/news.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { DEFAULT_E2E_GLOBAL_SETTINGS } from "../../../test/helpers/e2e-settings";
import { McpTokenService } from "../mcp-token.service";
import { MCP_REQUESTABLE_SCOPES, MCP_SCOPES } from "../mcp-tool-scope";

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
    scopes: string[] = MCP_REQUESTABLE_SCOPES.filter((scope) => scope !== MCP_SCOPES.STUDENT_READ),
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

  it("preserves the frozen management catalog for an existing legacy authoring grant", async () => {
    const legacy = await issueClient(admin.user, admin.host, [MCP_SCOPES.AUTHORING]);
    const tools = (await rpc(legacy, "tools/list")).result.tools.map(
      (tool: ToolResult) => tool.name,
    );
    expect(tools).toEqual(
      expect.arrayContaining(["global_search", "create_course", "get_course", "list_users"]),
    );
    expect(tools.some((name: string) => name.includes("student"))).toBe(false);
    await rejectedCall("get_student_course", { courseId: draftCourseId }, legacy);
  });

  it("returns canonical tenant content links without lesson or directory groups for search scope", async () => {
    const search = await issueClient(admin.user, admin.host, [MCP_SCOPES.SEARCH_READ]);
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
    expect(learner.users).toEqual([]);
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
