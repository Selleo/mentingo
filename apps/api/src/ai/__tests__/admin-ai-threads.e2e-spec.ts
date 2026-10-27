import { MESSAGE_ROLE, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq, sql } from "drizzle-orm";
import request from "supertest";

import { AssistantRepository } from "src/assistant/assistant.repository";
import { AssistantRuntimeService } from "src/assistant/workflow/assistant-runtime.service";
import { McpHttpService } from "src/mcp/mcp-http.service";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";
import {
  assistantThreads,
  assistantRuns,
  assistantMessages,
  aiJudgeConfigurations,
  aiMentorJudgementCriteria,
  aiMentorJudgements,
  aiMentorPracticeSessions,
  aiMentorThreadMessages,
  aiMentorThreads,
  tenants,
  permissionUserRoles,
  permissionRoles,
} from "../../storage/schema";

import { createAiMentorLessonFactory } from "./createAiMentorLesson";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Admin AI conversations (tenant RLS)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let tenantId: string;
  let adminCookie: string;
  let ownerCookie: string;
  let ownerId: string;
  let practiceId: string;
  let assistantId: string;
  let foreignAssistantId: string;
  let lessonThreadId: string;
  let foreignThreadId: string;
  let foreignOwnerId: string;
  let foreignTenantId: string;
  const assistantRuntime = {
    isAvailable: jest.fn(() => true),
    start: jest.fn(async () => ({ workflowRunId: "deterministic-e2e-run" })),
    cancel: jest.fn(async () => {}),
  };

  beforeAll(async () => {
    const context = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: AssistantRuntimeService, useValue: assistantRuntime }],
    });
    app = context.app;
    db = context.dbAdmin;
    tenantId = context.defaultTenantId;
    // The admin pool predates the harness ALTER DATABASE default; initialize its existing session.
    await db.execute(sql`SELECT set_config('app.tenant_id', ${tenantId}, false)`);
    await createSettingsFactory(db).create({ userId: null });
    const factory = createUserFactory(db);
    const admin = await factory
      .withCredentials({ password: "Password123@" })
      .withAdminSettings(db)
      .create();
    const owner = await factory
      .withCredentials({ password: "Password123@" })
      .withUserSettings(db)
      .create();
    ownerId = owner.id;
    ownerCookie = await cookieFor(owner, app);
    adminCookie = await cookieFor(admin, app);
    const [session] = await db
      .insert(aiMentorPracticeSessions)
      .values({
        userId: ownerId,
        tenantId,
        practiceDate: "2026-09-10",
        language: "en",
        title: "Negotiation practice",
        scenario: "Negotiate",
        status: "ready",
      })
      .returning();
    const [practice] = await db
      .insert(aiMentorThreads)
      .values({
        userId: ownerId,
        tenantId,
        practiceSessionId: session.id,
        status: "archived",
        createdAt: "2026-09-01T10:00:00Z",
      })
      .returning();
    practiceId = practice.id;
    const mentor = await createAiMentorLessonFactory(db).create();
    const [lessonThread] = await db
      .insert(aiMentorThreads)
      .values({
        userId: ownerId,
        tenantId,
        aiMentorLessonId: mentor.id,
        status: "active",
        createdAt: "2026-09-02T10:00:00Z",
      })
      .returning();
    lessonThreadId = lessonThread.id;
    await db.insert(aiMentorThreadMessages).values([
      {
        threadId: practiceId,
        tenantId,
        role: MESSAGE_ROLE.SYSTEM,
        content: "SECRET SYSTEM PROMPT",
      },
      { threadId: practiceId, tenantId, role: MESSAGE_ROLE.SUMMARY, content: "SECRET SUMMARY" },
      ...Array.from({ length: 101 }, (_, index) => ({
        threadId: practiceId,
        tenantId,
        role: index % 2 ? MESSAGE_ROLE.USER : MESSAGE_ROLE.MENTOR,
        content: `Saved message ${index}`,
        archived: index < 80,
        createdAt: new Date(Date.UTC(2026, 8, 1, 10, index)).toISOString(),
      })),
    ]);
    const [configuration] = await db
      .insert(aiJudgeConfigurations)
      .values({
        tenantId,
        practiceSessionId: session.id,
        passingThresholdPercent: 100,
      })
      .returning();
    const [judgement] = await db
      .insert(aiMentorJudgements)
      .values({
        tenantId,
        threadId: practiceId,
        configurationId: configuration.id,
        language: "en",
        earnedPoints: 3,
        maxScore: 5,
        percentage: 60,
        passed: true,
      })
      .returning();
    await db.insert(aiMentorJudgementCriteria).values({
      tenantId,
      judgementId: judgement.id,
      criterionId: null,
      criterionTitle: "Original criterion",
      awardedPoints: 3,
      maxScoreAtJudgement: 5,
      status: "met",
      learnerSafeFeedback: "Saved feedback",
    });
    const [assistant] = await db
      .insert(assistantThreads)
      .values({
        tenantId,
        userId: ownerId,
        title: "Workplace assistant",
        language: "pl",
        createdAt: "2026-08-30T10:00:00Z",
      })
      .returning();
    assistantId = assistant.id;
    await db.insert(assistantMessages).values([
      {
        tenantId,
        threadId: assistantId,
        role: "user",
        text: "My private question",
        createdAt: "2026-08-30T10:01:00Z",
      },
      {
        tenantId,
        threadId: assistantId,
        role: "assistant",
        text: "My saved answer",
        status: "complete",
        createdAt: "2026-08-30T10:02:00Z",
      },
      {
        tenantId,
        threadId: assistantId,
        role: "assistant",
        text: "Partial saved answer",
        status: "failed",
        createdAt: "2026-08-30T10:03:00Z",
      },
    ]);
    const [foreignTenant] = await db
      .insert(tenants)
      .values({ name: "Other organization", host: `https://admin-ai-${crypto.randomUUID()}.local` })
      .returning();
    foreignTenantId = foreignTenant.id;
    const foreignOwner = await factory.create({ tenantId: foreignTenant.id });
    foreignOwnerId = foreignOwner.id;
    const [foreignAssistant] = await db
      .insert(assistantThreads)
      .values({
        tenantId: foreignTenant.id,
        userId: foreignOwnerId,
        title: "Foreign assistant",
      })
      .returning();
    foreignAssistantId = foreignAssistant.id;
    const [foreignSession] = await db
      .insert(aiMentorPracticeSessions)
      .values({
        tenantId: foreignTenant.id,
        userId: foreignOwnerId,
        practiceDate: "2026-09-10",
        language: "en",
        scenario: "Private",
        title: "Private conversation",
      })
      .returning();
    const [foreignThread] = await db
      .insert(aiMentorThreads)
      .values({
        tenantId: foreignTenant.id,
        userId: foreignOwnerId,
        practiceSessionId: foreignSession.id,
      })
      .returning();
    foreignThreadId = foreignThread.id;
  }, 60000);

  afterAll(async () => {
    if (foreignTenantId) await db.delete(tenants).where(eq(tenants.id, foreignTenantId));
    await app?.close();
  });

  it("lists all sources with correct owners, stable pagination and combined filters", async () => {
    const first = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ perPage: 1 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(first.body.pagination.totalItems).toBe(3);
    expect(first.body.data[0]).toMatchObject({
      id: lessonThreadId,
      owner: { id: ownerId },
      type: "ai-mentor",
    });
    const second = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ perPage: 1, page: 2 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(second.body.data[0].id).toBe(practiceId);
    const filtered = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({
        userId: ownerId,
        type: "practice",
        status: "archived",
        search: "Negotiation",
        from: "2026-09-01T00:00:00Z",
        to: "2026-09-02T00:00:00Z",
      })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0]).toMatchObject({
      id: practiceId,
      title: "Negotiation practice",
      openingPreview: "Saved message 0",
    });
  });

  it("filters assistant conversations and returns their separate transcript without lesson results", async () => {
    const list = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({
        type: "assistant",
        search: "Workplace",
        userId: ownerId,
        from: "2026-08-30T00:00:00Z",
        to: "2026-08-31T00:00:00Z",
      })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(list.body.pagination.totalItems).toBe(1);
    expect(list.body.data).toEqual([
      expect.objectContaining({
        id: assistantId,
        type: "assistant",
        language: "pl",
        openingPreview: "My private question",
        lessonId: null,
        aiMentorLessonId: null,
        practiceSessionId: null,
        courseId: null,
        courseTitle: null,
      }),
    ]);
    const detail = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${assistantId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(detail.body.data.evaluation).toBeNull();
    const messages = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${assistantId}/messages`)
      .query({ perPage: 1, page: 2 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(messages.body.pagination.totalItems).toBe(3);
    expect(messages.body.data).toEqual([
      expect.objectContaining({ role: MESSAGE_ROLE.MENTOR, content: "My saved answer" }),
    ]);
    const failed = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${assistantId}/messages`)
      .query({ perPage: 1, page: 3 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(failed.body.data).toEqual([
      expect.objectContaining({ content: "Partial saved answer", status: "failed" }),
    ]);
  });

  it("includes summarized history, excludes internal messages and paginates chronologically", async () => {
    const first = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${practiceId}/messages`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(first.body.pagination.totalItems).toBe(101);
    expect(first.body.data).toHaveLength(100);
    expect(first.body.data[0].content).toBe("Saved message 0");
    expect(first.body.data[99].content).toBe("Saved message 99");
    const second = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${practiceId}/messages`)
      .query({ page: 2 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(second.body.data.map((message: { content: string }) => message.content)).toEqual([
      "Saved message 100",
    ]);
    const empty = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${lessonThreadId}/messages`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(empty.body.data).toEqual([]);
  });

  it("returns the saved result despite a different current threshold and deleted criterion", async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${practiceId}`)
      .set("Cookie", adminCookie)
      .expect(200);
    expect(response.body.data.evaluation).toMatchObject({
      passed: true,
      percentage: 60,
      criteria: [
        { criterionId: null, title: "Original criterion", learnerSafeFeedback: "Saved feedback" },
      ],
    });
    expect(response.body.data.evaluation.requiredScore).toBeUndefined();
  });

  it("isolates foreign owner searches, details and messages through real tenant RLS", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ userId: foreignOwnerId })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(response.body.data).toEqual([]);
    await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${foreignThreadId}`)
      .set("Cookie", adminCookie)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/admin/ai-threads/${foreignThreadId}/messages`)
      .set("Cookie", adminCookie)
      .expect(404);
  });

  it("does not expose assistant storage through learner lesson-result endpoints", async () => {
    for (const path of ["/api/ai/thread", "/api/ai/thread/messages"]) {
      await request(app.getHttpServer())
        .get(path)
        .query({ thread: assistantId })
        .set("Cookie", ownerCookie)
        .expect(404);
    }
  });

  it("keeps foreign assistant details and transcript outside tenant scope", async () => {
    for (const suffix of ["", "/messages"]) {
      await request(app.getHttpServer())
        .get(`/api/admin/ai-threads/${foreignAssistantId}${suffix}`)
        .set("Cookie", adminCookie)
        .expect(404);
    }
  });

  it.each([
    SYSTEM_ROLE_SLUGS.STUDENT,
    SYSTEM_ROLE_SLUGS.CONTENT_CREATOR,
    SYSTEM_ROLE_SLUGS.GROUP_MANAGER,
  ])("denies %s on every read endpoint", async (roleSlug) => {
    const user = await createUserFactory(db)
      .withCredentials({ password: "Password123@" })
      .create({ roleSlug, tenantId });
    await createSettingsFactory(db, user.id).create();
    const cookie = await cookieFor(user, app);
    for (const path of [
      "",
      `/${practiceId}`,
      `/${practiceId}/messages`,
      `/${assistantId}`,
      `/${assistantId}/messages`,
    ]) {
      await request(app.getHttpServer())
        .get(`/api/admin/ai-threads${path}`)
        .set("Cookie", cookie)
        .expect(403);
    }
  });

  it("rejects anonymous and invalid pagination/date requests", async () => {
    await request(app.getHttpServer()).get("/api/admin/ai-threads").expect(401);
    await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ perPage: 101 })
      .set("Cookie", adminCookie)
      .expect(400);
    await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ from: "2026-09-03T00:00:00Z", to: "2026-09-01T00:00:00Z" })
      .set("Cookie", adminCookie)
      .expect(400);
  });
  describe("native assistant HTTP persistence and access", () => {
    const createThread = async () => {
      const response = await request(app.getHttpServer())
        .post("/api/assistant/threads")
        .send({ title: "Assistant E2E", language: "en" })
        .set("Cookie", ownerCookie)
        .expect(201);
      return response.body.data.id as string;
    };
    const send = (threadId: string, clientMessageId: string, text = "Saved native question") =>
      request(app.getHttpServer())
        .post(`/api/assistant/threads/${threadId}/messages`)
        .send({ text, clientMessageId, language: "en" })
        .set("Cookie", ownerCookie);

    it("persists owner messages, retries idempotently and serializes active runs", async () => {
      const threadId = await createThread();
      const clientMessageId = crypto.randomUUID();
      const first = await send(threadId, clientMessageId).expect(201);
      const retry = await send(threadId, clientMessageId).expect(201);
      expect(retry.body.data.run.id).toBe(first.body.data.run.id);
      expect(retry.body.data.userMessage.id).toBe(first.body.data.userMessage.id);
      await send(threadId, clientMessageId, "Conflicting text").expect(409);
      await send(threadId, crypto.randomUUID()).expect(409);
      const transcript = await request(app.getHttpServer())
        .get(`/api/assistant/threads/${threadId}/messages`)
        .set("Cookie", ownerCookie)
        .expect(200);
      expect(transcript.body.data.totalItems).toBe(2);
      expect(transcript.body.data.items.map((message: { role: string }) => message.role)).toEqual([
        "user",
        "assistant",
      ]);
      await request(app.getHttpServer())
        .post(`/api/assistant/threads/${threadId}/runs/${first.body.data.run.id}/cancel`)
        .set("Cookie", ownerCookie)
        .expect(201);
      await send(threadId, crypto.randomUUID()).expect(201);
    });

    it("enforces private ownership separately from admin conversation oversight", async () => {
      for (const id of [assistantId, foreignAssistantId]) {
        // An admin's normal Assistant endpoint still cannot open somebody else's private thread.
        for (const suffix of ["", "/messages"]) {
          await request(app.getHttpServer())
            .get(`/api/assistant/threads/${id}${suffix}`)
            .set("Cookie", adminCookie)
            .expect(404);
        }
        await request(app.getHttpServer())
          .patch(`/api/assistant/threads/${id}`)
          .send({ title: "Unauthorized edit" })
          .set("Cookie", adminCookie)
          .expect(404);
      }
      const owned = await request(app.getHttpServer())
        .get(`/api/assistant/threads/${assistantId}`)
        .set("Cookie", ownerCookie)
        .expect(200);
      expect(owned.body.data.userId).toBe(ownerId);
      await request(app.getHttpServer())
        .get(`/api/assistant/threads/${foreignAssistantId}`)
        .set("Cookie", ownerCookie)
        .expect(404);
    });

    it("blocks archived sends and leaves storage untouched when runtime is unavailable", async () => {
      const threadId = await createThread();
      await request(app.getHttpServer())
        .patch(`/api/assistant/threads/${threadId}`)
        .send({ archived: true })
        .set("Cookie", ownerCookie)
        .expect(200);
      await send(threadId, crypto.randomUUID()).expect(409);
      await request(app.getHttpServer())
        .patch(`/api/assistant/threads/${threadId}`)
        .send({ archived: false })
        .set("Cookie", ownerCookie)
        .expect(200);
      assistantRuntime.isAvailable.mockReturnValue(false);
      try {
        await send(threadId, crypto.randomUUID()).expect(503);
      } finally {
        assistantRuntime.isAvailable.mockReturnValue(true);
      }
      const transcript = await request(app.getHttpServer())
        .get(`/api/assistant/threads/${threadId}/messages`)
        .set("Cookie", ownerCookie)
        .expect(200);
      expect(transcript.body.data.totalItems).toBe(0);
    });

    it.each([
      ["00000000-0000-4000-8000-000000000011", "ffffffff-ffff-4fff-8fff-fffffffffff1"],
      ["ffffffff-ffff-4fff-8fff-fffffffffff2", "00000000-0000-4000-8000-000000000012"],
    ])(
      "keeps equal-timestamp user/assistant pairs causal regardless of UUID order (%s)",
      async (userMessageId, assistantMessageId) => {
        const threadId = await createThread();
        const timestamp = "2026-10-23T12:00:00Z";
        await db.insert(assistantMessages).values([
          {
            id: assistantMessageId,
            tenantId,
            threadId,
            role: "assistant",
            text: "Answer fixture",
            status: "complete",
            createdAt: timestamp,
          },
          {
            id: userMessageId,
            tenantId,
            threadId,
            role: "user",
            text: "Question fixture",
            status: "complete",
            createdAt: timestamp,
          },
        ]);
        const [run] = await db
          .insert(assistantRuns)
          .values({
            tenantId,
            threadId,
            userId: ownerId,
            userMessageId,
            assistantMessageId,
            language: "en",
            origin: "https://tenant.local",
            status: "completed",
          })
          .returning();
        const fetchMessages = (page: number, perPage: number) =>
          request(app.getHttpServer())
            .get(`/api/assistant/threads/${threadId}/messages`)
            .query({ page, perPage })
            .set("Cookie", ownerCookie)
            .expect(200);
        const pair = await fetchMessages(1, 2);
        expect(pair.body.data.items.map((message: { id: string }) => message.id)).toEqual([
          userMessageId,
          assistantMessageId,
        ]);
        const newest = await fetchMessages(1, 1);
        const older = await fetchMessages(2, 1);
        expect(newest.body.data.items[0].id).toBe(assistantMessageId);
        expect(older.body.data.items[0].id).toBe(userMessageId);
        const history = await app.get(AssistantRepository).getHistory({ tenantId, runId: run.id });
        expect(history.map((message) => message.id)).toEqual([userMessageId, assistantMessageId]);
      },
    );

    it("allows a roleless active account to use Assistant while keeping private ownership and content tools restricted", async () => {
      await db.delete(permissionUserRoles).where(eq(permissionUserRoles.userId, ownerId));
      await request(app.getHttpServer())
        .get("/api/assistant/threads")
        .set("Cookie", ownerCookie)
        .expect(200);
      const threadId = await createThread();
      await send(threadId, crypto.randomUUID(), "Hello fixture").expect(201);
      const tools = await app
        .get(McpHttpService)
        .listNativeReadTools(ownerId, tenantId, "https://tenant.local");
      expect(tools.map((tool) => tool.name)).not.toContain("list_users");
      expect(tools.map((tool) => tool.name)).not.toContain("list_courses");
      await expect(
        app
          .get(McpHttpService)
          .executeNativeReadTool(ownerId, tenantId, "https://tenant.local", "list_users", {}),
      ).rejects.toThrow("unavailable");
      const [customRole] = await db
        .insert(permissionRoles)
        .values({ tenantId, name: "Assistant custom fixture", slug: "assistant-custom-fixture" })
        .returning();
      await db
        .insert(permissionUserRoles)
        .values({ tenantId, userId: ownerId, roleId: customRole.id });
      await request(app.getHttpServer())
        .get("/api/assistant/availability")
        .set("Cookie", ownerCookie)
        .expect(200);
      const customThreadId = await createThread();
      await send(customThreadId, crypto.randomUUID(), "Custom-role fixture").expect(201);
      await request(app.getHttpServer())
        .get(`/api/assistant/threads/${foreignAssistantId}`)
        .set("Cookie", ownerCookie)
        .expect(404);
      await request(app.getHttpServer()).get("/api/assistant/availability").expect(401);
    });
  });
});
