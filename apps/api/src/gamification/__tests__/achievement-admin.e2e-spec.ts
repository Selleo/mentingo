import { randomUUID } from "node:crypto";

import {
  ACHIEVEMENT_BADGE_FILE_RESOURCE,
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_TYPES,
} from "@repo/shared";
import { subDays } from "date-fns";
import { eq } from "drizzle-orm";
import request from "supertest";

import { LessonCompletedEvent, QuizCompletedEvent } from "src/events";
import { GamificationService } from "src/gamification/gamification.service";
import { PREDEFINED_ACHIEVEMENTS } from "src/gamification/predefined-achievements";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { achievements, outboxEvents, userAchievementProgress } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { UpsertAchievementBody } from "src/gamification/schemas/achievement-admin.schema";

const PASSWORD = "Password123@@";
const ADMIN_ACHIEVEMENTS_URL = "/api/gamification/admin/achievements";

type AchievementOverrides = Omit<Partial<UpsertAchievementBody>, "levels"> & {
  levels?: Array<
    Omit<UpsertAchievementBody["levels"][number], "badgeImageKey"> & {
      badgeImageKey?: string | null;
    }
  >;
};

const buildAchievement = ({
  levels,
  ...overrides
}: AchievementOverrides = {}): UpsertAchievementBody => ({
  title: { en: "Quiz fan", pl: "  " },
  description: { en: "Pass quizzes with a high score." },
  baseLanguage: "en",
  eventType: GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED,
  requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.COUNT,
  windowDays: null,
  filters: { minScore: 80 },
  visibility: ACHIEVEMENT_VISIBILITY.VISIBLE,
  isEnabled: true,
  icon: ACHIEVEMENT_ICONS.TARGET,
  ...overrides,
  levels: (
    levels ?? [
      { threshold: 2, xpReward: 40 },
      { threshold: 4, xpReward: 80 },
    ]
  ).map((level) => ({ badgeImageKey: null, ...level })),
});

describe("Achievement admin (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let gamificationService: GamificationService;
  let runAsTenant: <T>(function_: () => Promise<T>) => Promise<T>;
  let tenantId: UUIDType;
  let admin: UserWithCredentials;
  let student: UserWithCredentials;

  const storeEvent = (event: object, createdAt?: Date) =>
    db.insert(outboxEvents).values({
      eventType: event.constructor.name,
      payload: JSON.parse(JSON.stringify(event)),
      status: "published",
      ...(createdAt ? { createdAt: createdAt.toISOString() } : {}),
    });

  const completeQuiz = (userId: UUIDType, score: number) =>
    storeEvent(
      new QuizCompletedEvent({
        userId,
        courseId: randomUUID(),
        lessonId: randomUUID(),
        correctAnswers: 1,
        wrongAnswers: 0,
        score,
        isSupportMode: false,
      }),
    );

  const completeLessonOn = (userId: UUIDType, createdAt: Date) =>
    storeEvent(
      new LessonCompletedEvent({
        userId,
        courseId: randomUUID(),
        lessonId: randomUUID(),
        actor: {
          userId,
          email: "actor@example.com",
          roleSlugs: [],
          permissions: [],
          tenantId: randomUUID(),
        },
      }),
      createdAt,
    );

  const evaluate = (userId: UUIDType) =>
    runAsTenant(() => gamificationService.evaluateUser(userId, randomUUID()));

  const getProgress = async (userId: UUIDType, achievementId: UUIDType) => {
    const rows = await db
      .select({
        achievementId: userAchievementProgress.achievementId,
        value: userAchievementProgress.value,
      })
      .from(userAchievementProgress)
      .where(eq(userAchievementProgress.userId, userId));

    return rows.find((row) => row.achievementId === achievementId)?.value ?? 0;
  };

  const getPredefinedId = async (key: string) => {
    const [row] = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(eq(achievements.key, key));

    return row.id;
  };

  const createAchievement = async (body: UpsertAchievementBody, status = 201) =>
    request(app.getHttpServer())
      .post(ADMIN_ACHIEVEMENTS_URL)
      .set("Cookie", await cookieFor(admin, app))
      .send(body)
      .expect(status);

  const updateAchievement = async (id: UUIDType, body: UpsertAchievementBody, status = 200) =>
    request(app.getHttpServer())
      .put(`${ADMIN_ACHIEVEMENTS_URL}/${id}`)
      .set("Cookie", await cookieFor(admin, app))
      .send(body)
      .expect(status);

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    gamificationService = app.get(GamificationService);
    runAsTenant = (function_) => testContext.runAsTenant(testContext.defaultTenantId, function_);
    tenantId = testContext.defaultTenantId;
  });

  beforeEach(async () => {
    await truncateTables(baseDb, ["achievements", "xp_transactions", "outbox_events", "settings"]);
    await createSettingsFactory(db, null).create({ userId: null });
    await runAsTenant(() => gamificationService.ensurePredefinedAchievements());

    const userFactory = createUserFactory(db);

    admin = await userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create();
    student = await userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create();
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists predefined achievements for admins and rejects students", async () => {
    const response = await request(app.getHttpServer())
      .get(`${ADMIN_ACHIEVEMENTS_URL}?language=en`)
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(response.body.data).toHaveLength(PREDEFINED_ACHIEVEMENTS.length);
    expect(response.body.data[0]).toMatchObject({
      isPredefined: true,
      levels: [expect.objectContaining({ level: 1, earnedCount: 0, badgeImageUrl: null })],
    });

    await request(app.getHttpServer())
      .get(`${ADMIN_ACHIEVEMENTS_URL}?language=en`)
      .set("Cookie", await cookieFor(student, app))
      .expect(403);
  });

  it("creates a custom achievement that the engine grants with its filters", async () => {
    const { body } = await createAchievement(buildAchievement());
    const achievementId = body.data.id;

    await completeQuiz(student.id, 90);
    await completeQuiz(student.id, 50);
    await completeQuiz(student.id, 85);

    expect(await evaluate(student.id)).toBe(40);

    const details = await request(app.getHttpServer())
      .get(`${ADMIN_ACHIEVEMENTS_URL}/${achievementId}?language=en`)
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(details.body.data).toMatchObject({
      isPredefined: false,
      icon: ACHIEVEMENT_ICONS.TARGET,
      title: { en: "Quiz fan" },
      baseLanguage: "en",
      filters: { minScore: 80 },
      levels: [
        { level: 1, threshold: 2, xpReward: 40, earnedCount: 1 },
        { level: 2, threshold: 4, xpReward: 80, earnedCount: 0 },
      ],
    });
  });

  it("measures time-window achievements over the best rolling window", async () => {
    const { body } = await createAchievement(
      buildAchievement({
        eventType: GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED,
        requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW,
        windowDays: 7,
        filters: {},
        levels: [{ threshold: 3, xpReward: 30 }],
      }),
    );
    const achievementId = body.data.id;
    const now = new Date();

    await completeLessonOn(student.id, subDays(now, 30));
    await completeLessonOn(student.id, subDays(now, 20));
    await completeLessonOn(student.id, subDays(now, 15));
    await evaluate(student.id);

    expect(await getProgress(student.id, achievementId)).toBe(2);

    await completeLessonOn(student.id, subDays(now, 14));
    await evaluate(student.id);

    expect(await getProgress(student.id, achievementId)).toBe(3);
  });

  it.each([
    ["a filter the event cannot evaluate", { eventType: GAMIFICATION_EVENT_TYPES.LOGIN }],
    ["a missing base-language title", { title: { pl: "Fan quizów" } }],
    [
      "a first-time achievement above threshold 1",
      {
        requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME,
        levels: [{ threshold: 2, xpReward: 10 }],
      },
    ],
    [
      "thresholds that do not ascend",
      {
        levels: [
          { threshold: 4, xpReward: 10 },
          { threshold: 4, xpReward: 20 },
        ],
      },
    ],
    [
      "a time window without its length",
      {
        requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW,
      },
    ],
    ["a window length on another requirement type", { windowDays: 7 }],
    [
      "more than three levels",
      {
        levels: [1, 2, 3, 4].map((threshold) => ({ threshold, xpReward: 10 })),
      },
    ],
    ["a course filter for a course outside the tenant", { filters: { courseId: randomUUID() } }],
    [
      "a level badge image key outside the tenant",
      { levels: [{ threshold: 1, xpReward: 10, badgeImageKey: "other/achievement-badges/a.png" }] },
    ],
  ])("rejects %s", async (_case, overrides) => {
    await createAchievement(buildAchievement(overrides as AchievementOverrides), 400);
  });

  it("accepts a level badge uploaded to the tenant and returns its URL", async () => {
    const badgeImageKey = `${tenantId}/${ACHIEVEMENT_BADGE_FILE_RESOURCE}/badge.png`;
    const { body } = await createAchievement(
      buildAchievement({ levels: [{ threshold: 2, xpReward: 40, badgeImageKey }] }),
    );

    const details = await request(app.getHttpServer())
      .get(`${ADMIN_ACHIEVEMENTS_URL}/${body.data.id}?language=en`)
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);
    const profile = await request(app.getHttpServer())
      .get(`/api/gamification/users/${student.id}?language=en`)
      .set("Cookie", await cookieFor(student, app))
      .expect(200);

    expect(details.body.data.levels).toEqual([
      expect.objectContaining({ badgeImageKey, badgeImageUrl: expect.any(String) }),
    ]);
    expect(
      profile.body.data.achievements.find(({ id }: { id: UUIDType }) => id === body.data.id).levels,
    ).toEqual([expect.objectContaining({ badgeImageUrl: expect.any(String) })]);
  });

  it("rejects a tenant file that was not uploaded as an achievement badge", async () => {
    await createAchievement(
      buildAchievement({
        levels: [{ threshold: 1, xpReward: 10, badgeImageKey: `${tenantId}/courses/cover.png` }],
      }),
      400,
    );
  });

  it("rejects students on every admin achievement endpoint", async () => {
    const { body } = await createAchievement(buildAchievement());
    const url = `${ADMIN_ACHIEVEMENTS_URL}/${body.data.id}`;
    const server = app.getHttpServer();
    const cookie = await cookieFor(student, app);

    await request(server).get(`${url}?language=en`).set("Cookie", cookie).expect(403);
    await request(server)
      .post(ADMIN_ACHIEVEMENTS_URL)
      .set("Cookie", cookie)
      .send(buildAchievement())
      .expect(403);
    await request(server).put(url).set("Cookie", cookie).send(buildAchievement()).expect(403);
    await request(server)
      .patch(`${url}/status`)
      .set("Cookie", cookie)
      .send({ isEnabled: false })
      .expect(403);
  });

  it("keeps predefined definitions read-only but lets admins disable them", async () => {
    const firstQuizId = await getPredefinedId("perfect_quiz");

    await updateAchievement(firstQuizId, buildAchievement(), 400);

    await request(app.getHttpServer())
      .patch(`${ADMIN_ACHIEVEMENTS_URL}/${firstQuizId}/status`)
      .set("Cookie", await cookieFor(admin, app))
      .send({ isEnabled: false })
      .expect(200);

    await completeQuiz(student.id, 100);

    expect(await evaluate(student.id)).toBe(0);
  });

  it("does not let an update remove a level someone has earned", async () => {
    const { body } = await createAchievement(buildAchievement());
    const achievementId = body.data.id;

    for (const score of [90, 90, 90, 90]) await completeQuiz(student.id, score);
    await evaluate(student.id);

    await updateAchievement(
      achievementId,
      buildAchievement({ levels: [{ threshold: 2, xpReward: 40 }] }),
      400,
    );
    await updateAchievement(
      achievementId,
      buildAchievement({
        levels: [
          { threshold: 2, xpReward: 40 },
          { threshold: 4, xpReward: 80 },
          { threshold: 8, xpReward: 160 },
        ],
      }),
    );

    const profile = await request(app.getHttpServer())
      .get(`/api/gamification/users/${student.id}?language=en`)
      .set("Cookie", await cookieFor(student, app))
      .expect(200);

    expect(
      profile.body.data.achievements.find(({ id }: { id: UUIDType }) => id === achievementId),
    ).toMatchObject({
      levels: [
        expect.objectContaining({ earnedAt: expect.any(String), badgeImageUrl: null }),
        expect.objectContaining({ earnedAt: expect.any(String) }),
        expect.objectContaining({ earnedAt: null }),
      ],
    });
  });

  it("re-measures progress when an update makes the achievement stricter", async () => {
    const { body } = await createAchievement(buildAchievement());
    const achievementId = body.data.id;

    for (const score of [90, 90, 85]) await completeQuiz(student.id, score);
    await evaluate(student.id);

    expect(await getProgress(student.id, achievementId)).toBe(3);

    await updateAchievement(achievementId, buildAchievement({ filters: { minScore: 88 } }));
    await evaluate(student.id);

    expect(await getProgress(student.id, achievementId)).toBe(2);
  });

  it("toggles the gamification setting for admins only", async () => {
    await request(app.getHttpServer())
      .patch("/api/settings/admin/gamification-enabled")
      .set("Cookie", await cookieFor(student, app))
      .expect(403);

    const response = await request(app.getHttpServer())
      .patch("/api/settings/admin/gamification-enabled")
      .set("Cookie", await cookieFor(admin, app))
      .expect(200);

    expect(response.body.data.gamificationEnabled).toBe(true);
  });
});
