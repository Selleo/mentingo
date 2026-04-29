import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";

import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { userStatistics } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("StatisticsController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let settingsFactory: ReturnType<typeof createSettingsFactory>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let adminUser: UserWithCredentials;
  let studentUser: UserWithCredentials;
  let adminCookies: string[];
  let studentCookies: string[];
  const password = "Password123@@";

  beforeAll(async () => {
    const { app: testApp } = await createE2ETest();
    app = testApp;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    settingsFactory = createSettingsFactory(db);
    userFactory = createUserFactory(db);
  });

  beforeEach(async () => {
    await settingsFactory.create({ userId: null });

    adminUser = await userFactory
      .withCredentials({ password })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });
    const adminCookie = await cookieFor(adminUser, app);
    adminCookies = Array.isArray(adminCookie) ? adminCookie : [adminCookie];

    studentUser = await userFactory
      .withCredentials({ password })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });
    const studentCookie = await cookieFor(studentUser, app);
    studentCookies = Array.isArray(studentCookie) ? studentCookie : [studentCookie];
  });

  afterEach(async () => {
    await truncateAllTables(dbAdmin, db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/statistics/user-stats", () => {
    it("returns 401 when user is not authenticated", async () => {
      await request(app.getHttpServer()).get("/api/statistics/user-stats?language=en").expect(401);
    });

    it("returns 400 when language query is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/statistics/user-stats?language=xx")
        .set("Cookie", studentCookies)
        .expect(400);
    });

    it("returns streak and zeroed aggregates for user without course/quiz progress", async () => {
      const activityHistory = {
        "2026-04-20": true,
        "2026-04-21": true,
      };

      await db.insert(userStatistics).values({
        userId: studentUser.id,
        currentStreak: 2,
        longestStreak: 5,
        activityHistory,
      });

      const response = await request(app.getHttpServer())
        .get("/api/statistics/user-stats?language=en")
        .set("Cookie", studentCookies)
        .expect(200);

      expect(response.body.data.streak).toEqual({
        current: 2,
        longest: 5,
        activityHistory,
      });
      expect(response.body.data.nextLesson).toBeNull();
      expect(response.body.data.quizzes).toEqual({
        totalAttempts: 0,
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        totalQuestions: 0,
        averageScore: 0,
        uniqueQuizzesTaken: 0,
      });
      expect(response.body.data.averageStats).toEqual({
        lessonStats: { started: 0, completed: 0, completionRate: 0 },
        courseStats: { started: 0, completed: 0, completionRate: 0 },
      });
      expect(Object.keys(response.body.data.courses)).toHaveLength(12);
      expect(Object.keys(response.body.data.lessons)).toHaveLength(12);
    });
  });

  describe("GET /api/statistics/stats", () => {
    it("returns 401 when user is not authenticated", async () => {
      await request(app.getHttpServer()).get("/api/statistics/stats?language=en").expect(401);
    });

    it("returns 400 when language query is invalid", async () => {
      await request(app.getHttpServer())
        .get("/api/statistics/stats?language=xx")
        .set("Cookie", adminCookies)
        .expect(400);
    });

    it("returns 403 for student without statistics permission", async () => {
      await request(app.getHttpServer())
        .get("/api/statistics/stats?language=en")
        .set("Cookie", studentCookies)
        .expect(403);
    });

    it("returns empty aggregate stats payload for admin in fresh tenant", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/statistics/stats?language=en")
        .set("Cookie", adminCookies)
        .expect(200);

      expect(response.body.data.fiveMostPopularCourses).toEqual([]);
      expect(response.body.data.totalCoursesCompletionStats).toEqual({
        completionPercentage: 0,
        totalCoursesCompletion: 0,
        totalCourses: 0,
      });
      expect(response.body.data.conversionAfterFreemiumLesson).toEqual({
        conversionPercentage: 0,
        purchasedCourses: 0,
        remainedOnFreemium: 0,
      });
      expect(response.body.data.avgQuizScore).toEqual({
        correctAnswerCount: 0,
        wrongAnswerCount: 0,
        answerCount: 0,
      });

      const monthStats = Object.values(
        response.body.data.courseStudentsStats as Record<string, { newStudentsCount: number }>,
      );
      expect(monthStats).toHaveLength(12);
      monthStats.forEach((month) => {
        expect(month).toEqual({ newStudentsCount: 0 });
      });
    });
  });
});
