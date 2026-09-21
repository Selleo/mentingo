import { MESSAGE_ROLE, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { eq } from "drizzle-orm";
import request from "supertest";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor } from "../../../test/helpers/test-helpers";
import {
  aiJudgeConfigurations,
  aiMentorJudgementCriteria,
  aiMentorJudgements,
  aiMentorPracticeSessions,
  aiMentorThreadMessages,
  aiMentorThreads,
  tenants,
} from "../../storage/schema";

import { createAiMentorLessonFactory } from "./createAiMentorLesson";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Admin AI conversations (tenant RLS)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let tenantId: string;
  let adminCookie: string;
  let ownerId: string;
  let practiceId: string;
  let lessonThreadId: string;
  let foreignThreadId: string;
  let foreignOwnerId: string;
  let foreignTenantId: string;

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true });
    app = context.app;
    db = context.dbAdmin;
    tenantId = context.defaultTenantId;
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
    const [foreignTenant] = await db
      .insert(tenants)
      .values({ name: "Other organization", host: `https://admin-ai-${crypto.randomUUID()}.local` })
      .returning();
    foreignTenantId = foreignTenant.id;
    const foreignOwner = await factory.create({ tenantId: foreignTenant.id });
    foreignOwnerId = foreignOwner.id;
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

  it("lists both sources with correct owners, stable pagination and combined filters", async () => {
    const first = await request(app.getHttpServer())
      .get("/api/admin/ai-threads")
      .query({ perPage: 1 })
      .set("Cookie", adminCookie)
      .expect(200);
    expect(first.body.pagination.totalItems).toBe(2);
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
    for (const path of ["", `/${practiceId}`, `/${practiceId}/messages`]) {
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
});
