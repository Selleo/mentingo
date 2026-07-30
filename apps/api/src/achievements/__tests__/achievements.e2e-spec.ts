import { eq } from "drizzle-orm";
import request from "supertest";

import { AchievementsService } from "src/achievements/achievements.service";
import { GamificationService } from "src/gamification/gamification.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  achievementLevels,
  achievements,
  userAchievementLevels,
  userProgress,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

// ─── helpers ─────────────────────────────────────────────────────────────────

const baseAchievementBody = (overrides: Record<string, unknown> = {}) => ({
  title: "Lesson Hero",
  language: "en",
  visibility: "visible",
  isEnabled: true,
  triggerEventType: "lesson",
  ...overrides,
});

// ─── suite ───────────────────────────────────────────────────────────────────

describe("Achievements E2E", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;

  let achievementsService: AchievementsService;
  let gamificationService: GamificationService;

  let userFactory: ReturnType<typeof createUserFactory>;

  let adminCookie: string;
  let studentUserId: UUIDType;
  let tenantId: UUIDType;

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;

    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);

    achievementsService = app.get(AchievementsService);
    gamificationService = app.get(GamificationService);

    userFactory = createUserFactory(db);
  }, 60000);

  afterAll(async () => {
    await truncateAllTables(baseDb, db);
    await app.close();
  });

  beforeEach(async () => {
    await truncateAllTables(baseDb, db);

    const adminUser = await userFactory
      .withCredentials({ password: "Admin1234!" })
      .withAdminSettings(db)
      .create();
    const studentUser = await userFactory
      .withCredentials({ password: "Student1234!" })
      .withUserSettings(db)
      .create();

    studentUserId = studentUser.id;
    tenantId = adminUser.tenantId;

    adminCookie = await cookieFor(adminUser, app);
  });

  // ─── GET /achievements ────────────────────────────────────────────────────

  describe("GET /api/achievements", () => {
    it("returns existing achievements", async () => {
      await achievementsService.createAchievement(baseAchievementBody() as any);

      const res = await request(app.getHttpServer())
        .get("/api/achievements")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── POST /achievements ───────────────────────────────────────────────────

  describe("POST /api/achievements", () => {
    it("creates a new achievement and persists it in the database", async () => {
      const res = await request(app.getHttpServer())
        .post("/api/achievements")
        .set("Cookie", adminCookie)
        .send(baseAchievementBody());

      expect(res.status).toBe(201);

      const [row] = await db.select().from(achievements);
      expect(row).toBeDefined();
      expect(row.triggerEventType).toBe("lesson");
      expect(row.isEnabled).toBe(true);
      expect(row.visibility).toBe("visible");
    });

    it("stores the title as localised JSONB with correct language key", async () => {
      await request(app.getHttpServer())
        .post("/api/achievements")
        .set("Cookie", adminCookie)
        .send(baseAchievementBody({ title: "Streak King", language: "en" }));

      const [row] = await db.select().from(achievements);
      expect((row.title as Record<string, string>)["en"]).toBe("Streak King");
    });
  });

  // ─── GET /achievements/:id ────────────────────────────────────────────────

  describe("GET /api/achievements/:id", () => {
    it("returns 200 with the achievement when it exists", async () => {
      const created = await achievementsService.createAchievement(baseAchievementBody() as any);

      const res = await request(app.getHttpServer())
        .get(`/api/achievements/${created.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
    });

    it("returns 404 when achievement does not exist", async () => {
      const res = await request(app.getHttpServer())
        .get("/api/achievements/00000000-0000-4000-8000-000000000001")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });

  // ─── DELETE /achievements/:id ─────────────────────────────────────────────

  describe("DELETE /api/achievements/:id", () => {
    it("removes the achievement from the database", async () => {
      const created = await achievementsService.createAchievement(baseAchievementBody() as any);

      const res = await request(app.getHttpServer())
        .delete(`/api/achievements/${created.id}`)
        .set("Cookie", adminCookie);

      expect(res.status).toBe(200);

      const rows = await db.select().from(achievements).where(eq(achievements.id, created.id));
      expect(rows).toHaveLength(0);
    });

    it("returns 404 when trying to delete a non-existent achievement", async () => {
      const res = await request(app.getHttpServer())
        .delete("/api/achievements/00000000-0000-4000-8000-000000000001")
        .set("Cookie", adminCookie);

      expect(res.status).toBe(404);
    });
  });

  // ─── Achievement levels CRUD ──────────────────────────────────────────────

  describe("Achievement levels", () => {
    let achievementId: UUIDType;

    beforeEach(async () => {
      const created = await achievementsService.createAchievement(baseAchievementBody() as any);
      achievementId = created.id;
    });

    describe("POST /api/achievements/levels/:achievementId", () => {
      it("creates first level (levelNumber = 1) and persists it", async () => {
        const res = await request(app.getHttpServer())
          .post(`/api/achievements/levels/${achievementId}`)
          .set("Cookie", adminCookie)
          .send({ threshold: 5, xpReward: 50 });

        expect(res.status).toBe(201);

        const [row] = await db
          .select()
          .from(achievementLevels)
          .where(eq(achievementLevels.achievementId, achievementId));

        expect(row).toBeDefined();
        expect(row.levelNumber).toBe(1);
        expect(row.threshold).toBe(5);
        expect(row.xpReward).toBe(50);
      });

      it("rejects a level whose threshold is not greater than the current highest", async () => {
        await achievementsService.createAchievementLevel(
          { threshold: 10, xpReward: 50 },
          achievementId,
        );

        const res = await request(app.getHttpServer())
          .post(`/api/achievements/levels/${achievementId}`)
          .set("Cookie", adminCookie)
          .send({ threshold: 10, xpReward: 100 });

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE /api/achievements/levels/:achievementId", () => {
      it("deletes only the highest level", async () => {
        await achievementsService.createAchievementLevel(
          { threshold: 5, xpReward: 50 },
          achievementId,
        );
        await achievementsService.createAchievementLevel(
          { threshold: 10, xpReward: 100 },
          achievementId,
        );

        const res = await request(app.getHttpServer())
          .delete(`/api/achievements/levels/${achievementId}`)
          .set("Cookie", adminCookie);

        expect(res.status).toBe(200);

        const remaining = await db
          .select()
          .from(achievementLevels)
          .where(eq(achievementLevels.achievementId, achievementId));

        expect(remaining).toHaveLength(1);
        expect(remaining[0].levelNumber).toBe(1);
      });
    });
  });

  // ─── Translation ──────────────────────────────────────────────────────────

  describe("POST /api/achievements/:id/translation", () => {
    it("adds a new locale to the achievement", async () => {
      const created = await achievementsService.createAchievement(baseAchievementBody() as any);

      const res = await request(app.getHttpServer())
        .post(`/api/achievements/${created.id}/translation?language=pl`)
        .set("Cookie", adminCookie)
        .send({ title: "Bohater Lekcji" });

      expect(res.status).toBe(201);

      const [row] = await db.select().from(achievements).where(eq(achievements.id, created.id));

      expect(row.availableLocales).toContain("pl");
      expect((row.title as Record<string, string>)["pl"]).toBe("Bohater Lekcji");
    });

    it("returns 409 when locale already exists", async () => {
      const created = await achievementsService.createAchievement(baseAchievementBody() as any);

      const res = await request(app.getHttpServer())
        .post(`/api/achievements/${created.id}/translation?language=en`)
        .set("Cookie", adminCookie)
        .send({ title: "Duplicate" });

      expect(res.status).toBe(409);
    });
  });

  // ─── Gamification: processAchievements ────────────────────────────────────

  describe("GamificationService.processAchievements", () => {
    const event = (userId: UUIDType, tid: UUIDType) => ({
      userId,
      tenantId: tid,
      sourceId: "55555555-5555-5555-5555-555555555555",
      actorRole: "student" as const,
      actionType: "complete_lesson",
      resourceType: "lesson",
      canViewHidden: false,
    });

    it("creates a userProgress row if one does not exist yet", async () => {
      const achievement = await achievementsService.createAchievement(baseAchievementBody() as any);
      const level = await achievementsService.createAchievementLevel(
        { threshold: 1, xpReward: 50 },
        achievement.id,
      );

      await gamificationService.processAchievements(
        [{ id: level.id, levelNumber: 1, threshold: 1, xpReward: 50, achievementName: "X" }],
        1,
        event(studentUserId, tenantId),
      );

      const [progress] = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, studentUserId));

      expect(progress).toBeDefined();
    });

    it("adds XP to the user when an achievement level is earned", async () => {
      const achievement = await achievementsService.createAchievement(baseAchievementBody() as any);
      const level = await achievementsService.createAchievementLevel(
        { threshold: 1, xpReward: 75 },
        achievement.id,
      );

      await gamificationService.processAchievements(
        [{ id: level.id, levelNumber: 1, threshold: 1, xpReward: 75, achievementName: "X" }],
        1,
        event(studentUserId, tenantId),
      );

      const [progress] = await db
        .select()
        .from(userProgress)
        .where(eq(userProgress.userId, studentUserId));

      expect(progress.spendableXp).toBe(75);
      expect(progress.lifetimeXp).toBe(75);
    });

    it("does not award XP when actualThreshold is below all level thresholds", async () => {
      const achievement = await achievementsService.createAchievement(baseAchievementBody() as any);
      const level = await achievementsService.createAchievementLevel(
        { threshold: 10, xpReward: 100 },
        achievement.id,
      );

      await gamificationService.processAchievements(
        [{ id: level.id, levelNumber: 1, threshold: 10, xpReward: 100, achievementName: "X" }],
        3,
        event(studentUserId, tenantId),
      );

      const rows = await db
        .select()
        .from(userAchievementLevels)
        .where(eq(userAchievementLevels.userId, studentUserId));

      expect(rows).toHaveLength(0);
    });

    it("does not insert duplicate userAchievementLevel row on repeated call", async () => {
      const achievement = await achievementsService.createAchievement(baseAchievementBody() as any);
      const level = await achievementsService.createAchievementLevel(
        { threshold: 1, xpReward: 50 },
        achievement.id,
      );

      const levelData = [
        { id: level.id, levelNumber: 1, threshold: 1, xpReward: 50, achievementName: "X" },
      ];
      const ev = event(studentUserId, tenantId);

      await gamificationService.processAchievements(levelData, 1, ev);
      await gamificationService.processAchievements(levelData, 1, {
        ...ev,
        sourceId: "66666666-6666-6666-6666-666666666666",
      });

      const rows = await db
        .select()
        .from(userAchievementLevels)
        .where(eq(userAchievementLevels.userId, studentUserId));

      expect(rows).toHaveLength(1);
    });
  });
});
