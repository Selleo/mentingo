import { randomUUID } from "node:crypto";

import { ACHIEVEMENT_ICONS, ACHIEVEMENT_VISIBILITY } from "@repo/shared";
import { subDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import {
  LessonCompletedEvent,
  QuizCompletedEvent,
  USER_LOGIN_METHOD,
  UserCourseFinishedEvent,
  UserLoginEvent,
} from "src/events";
import { GamificationService } from "src/gamification/gamification.service";
import { PREDEFINED_ACHIEVEMENTS } from "src/gamification/predefined-achievements";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  achievements,
  outboxEvents,
  userAchievementProgress,
  userGamificationProfiles,
  users,
  xpTransactions,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory, type UserWithCredentials } from "../../../test/factory/user.factory";
import { cookieFor, truncateTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

const PASSWORD = "Password123@@";

/** XP of a predefined achievement level, so tests follow reward tuning. */
const xpFor = (key: string, level = 1) => {
  const reward = PREDEFINED_ACHIEVEMENTS.find((definition) => definition.key === key)?.levels.find(
    (definitionLevel) => definitionLevel.level === level,
  )?.xpReward;

  if (reward === undefined) throw new Error(`Unknown predefined achievement ${key} level ${level}`);

  return reward;
};

describe("Gamification (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let tenantId: UUIDType;
  let gamificationService: GamificationService;
  let runAsTenant: <T>(function_: () => Promise<T>) => Promise<T>;
  let userFactory: ReturnType<typeof createUserFactory>;
  let student: UserWithCredentials;

  const courseId = randomUUID();

  const actorFor = (userId: UUIDType, isSupportMode = false): ActorUserType => ({
    userId,
    email: "actor@example.com",
    roleSlugs: [],
    permissions: [],
    tenantId,
    isSupportMode,
  });

  // Stores events the way the outbox publisher does, so payload paths match production.
  const storeEvent = (event: object, createdAt?: Date) =>
    db.insert(outboxEvents).values({
      eventType: event.constructor.name,
      payload: JSON.parse(JSON.stringify(event)),
      status: "published",
      ...(createdAt ? { createdAt: createdAt.toISOString() } : {}),
    });

  const completeLesson = (
    userId: UUIDType,
    { lessonId = randomUUID(), lessonCourseId = courseId, isSupportMode = false } = {},
  ) =>
    storeEvent(
      new LessonCompletedEvent({
        userId,
        courseId: lessonCourseId,
        lessonId,
        actor: actorFor(userId, isSupportMode),
      }),
    );

  const login = (userId: UUIDType, createdAt: Date) =>
    storeEvent(
      new UserLoginEvent({ userId, method: USER_LOGIN_METHOD.PASSWORD, actor: actorFor(userId) }),
      createdAt,
    );

  const completeQuiz = (userId: UUIDType, score: number, isSupportMode = false) =>
    storeEvent(
      new QuizCompletedEvent({
        userId,
        courseId,
        lessonId: randomUUID(),
        correctAnswers: 1,
        wrongAnswers: 0,
        score,
        isSupportMode,
      }),
    );

  const evaluate = (userId: UUIDType) =>
    runAsTenant(() => gamificationService.evaluateUser(userId, randomUUID()));

  const getProfile = async (userId: UUIDType) => {
    const [profile] = await db
      .select()
      .from(userGamificationProfiles)
      .where(eq(userGamificationProfiles.userId, userId));

    return profile;
  };

  const getAchievementId = async (key: string) => {
    const [achievement] = await db
      .select({ id: achievements.id })
      .from(achievements)
      .where(eq(achievements.key, key));

    return achievement.id;
  };

  const updateAchievement = (key: string, values: Partial<typeof achievements.$inferInsert>) =>
    db.update(achievements).set(values).where(eq(achievements.key, key));

  const fetchProfile = async (viewer: UserWithCredentials, userId: UUIDType, status = 200) =>
    request(app.getHttpServer())
      .get(`/api/gamification/users/${userId}?language=en`)
      .set("Cookie", await cookieFor(viewer, app))
      .expect(status);

  beforeAll(async () => {
    const testContext = await createE2ETest();

    app = testContext.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    tenantId = testContext.defaultTenantId;
    gamificationService = app.get(GamificationService);
    runAsTenant = (function_) => testContext.runAsTenant(testContext.defaultTenantId, function_);
    userFactory = createUserFactory(db);
  });

  beforeEach(async () => {
    await truncateTables(baseDb, ["achievements", "xp_transactions", "outbox_events", "settings"]);
    await createSettingsFactory(db, null).create({ userId: null });
    await runAsTenant(() => gamificationService.ensurePredefinedAchievements());

    student = await userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create();
  });

  afterAll(async () => {
    await app.close();
  });

  it("seeds predefined achievements once per tenant", async () => {
    const insertedAgain = await runAsTenant(() =>
      gamificationService.ensurePredefinedAchievements(),
    );

    expect(insertedAgain).toBe(0);
  });

  it("refreshes the icon of predefined achievements seeded before it changed", async () => {
    const [firstLogin] = PREDEFINED_ACHIEVEMENTS.filter(({ key }) => key === "first_login");

    await db
      .update(achievements)
      .set({ icon: ACHIEVEMENT_ICONS.TROPHY })
      .where(eq(achievements.key, firstLogin.key));

    expect(await runAsTenant(() => gamificationService.ensurePredefinedAchievements())).toBe(0);

    const [row] = await db
      .select({ icon: achievements.icon })
      .from(achievements)
      .where(eq(achievements.key, firstLogin.key));

    expect(row.icon).toBe(firstLogin.icon);
  });

  it("grants lesson achievements once, counting distinct lessons only", async () => {
    const repeatedLessonId = randomUUID();

    await completeLesson(student.id, { lessonId: repeatedLessonId });
    await completeLesson(student.id, { lessonId: repeatedLessonId });
    for (let index = 0; index < 4; index++) await completeLesson(student.id);

    const expectedXp = xpFor("first_lesson") + xpFor("lessons_completed");

    expect(await evaluate(student.id)).toBe(expectedXp);
    expect(await evaluate(student.id)).toBe(0);
    expect(await getProfile(student.id)).toMatchObject({
      lifetimeXp: expectedXp,
      spendableXp: expectedXp,
    });

    const transactions = await db
      .select()
      .from(xpTransactions)
      .where(eq(xpTransactions.userId, student.id));

    expect(transactions).toHaveLength(2);
  });

  it("ignores support-mode lessons and quizzes but counts the user's own activity", async () => {
    await completeLesson(student.id, { isSupportMode: true });
    await completeQuiz(student.id, 100, true);
    await completeLesson(student.id);

    expect(await evaluate(student.id)).toBe(xpFor("first_lesson"));
  });

  it("grants login streak levels from consecutive days and levels up", async () => {
    const today = new Date();

    for (let day = 0; day < 7; day++) await login(student.id, subDays(today, day));

    const expectedXp = xpFor("first_login") + xpFor("login_streak", 1) + xpFor("login_streak", 2);

    expect(await evaluate(student.id)).toBe(expectedXp);
    expect(await getProfile(student.id)).toMatchObject({ lifetimeXp: expectedXp, level: 2 });
  });

  it("measures the longest streak, not the number of login days", async () => {
    const today = new Date();

    // Two 3-day runs separated by a gap, plus a second login on the same day.
    for (const day of [0, 1, 2, 4, 5, 6]) await login(student.id, subDays(today, day));
    await login(student.id, today);

    expect(await evaluate(student.id)).toBe(xpFor("first_login") + xpFor("login_streak", 1));
  });

  it("grants course completion achievements", async () => {
    await storeEvent(
      new UserCourseFinishedEvent({ userId: student.id, courseId, actor: actorFor(student.id) }),
    );

    expect(await evaluate(student.id)).toBe(xpFor("first_course"));
  });

  it("applies the quiz score filter", async () => {
    await completeQuiz(student.id, 90);
    expect(await evaluate(student.id)).toBe(0);

    await completeQuiz(student.id, 100);
    expect(await evaluate(student.id)).toBe(xpFor("perfect_quiz"));
  });

  it("applies the course filter", async () => {
    const otherCourseId = randomUUID();

    await updateAchievement("lessons_completed", { filters: { courseId } });

    for (let index = 0; index < 5; index++) {
      await completeLesson(student.id, { lessonCourseId: otherCourseId });
    }

    for (let index = 0; index < 4; index++) await completeLesson(student.id);

    expect(await evaluate(student.id)).toBe(xpFor("first_lesson"));

    await completeLesson(student.id);

    expect(await evaluate(student.id)).toBe(xpFor("lessons_completed"));
  });

  it("does not let admins earn hidden achievements but still rewards them", async () => {
    const admin = await userFactory.withAdminSettings(db).create();

    await updateAchievement("first_lesson", { visibility: ACHIEVEMENT_VISIBILITY.HIDDEN });
    await completeLesson(admin.id);
    await login(admin.id, new Date());

    expect(await evaluate(admin.id)).toBe(xpFor("first_login"));
  });

  it.each([
    ["trainer", () => userFactory.withTrainerSettings(db).create()],
    ["content creator", () => userFactory.withContentCreatorSettings(db).create()],
  ])("lets a %s earn hidden achievements", async (_role, createUser) => {
    const user = await createUser();

    await updateAchievement("first_lesson", { visibility: ACHIEVEMENT_VISIBILITY.HIDDEN });
    await completeLesson(user.id);

    expect(await evaluate(user.id)).toBe(xpFor("first_lesson"));
  });

  it("stops granting disabled achievements", async () => {
    await updateAchievement("first_lesson", { isEnabled: false });
    await completeLesson(student.id);

    expect(await evaluate(student.id)).toBe(0);
  });

  it("keeps earned rewards after an achievement is disabled", async () => {
    const firstLessonId = await getAchievementId("first_lesson");
    const firstCourseId = await getAchievementId("first_course");

    await completeLesson(student.id);
    await evaluate(student.id);
    await updateAchievement("first_lesson", { isEnabled: false });
    await updateAchievement("first_course", { isEnabled: false });
    await completeLesson(student.id);

    expect(await evaluate(student.id)).toBe(0);
    expect(await getProfile(student.id)).toMatchObject({ lifetimeXp: xpFor("first_lesson") });

    const { body } = await fetchProfile(student, student.id);
    const achievementIds = body.data.achievements.map(({ id }: { id: string }) => id);
    const firstLesson = body.data.achievements.find(
      ({ id }: { id: string }) => id === firstLessonId,
    );

    expect(firstLesson.levels[0].earnedAt).not.toBeNull();
    expect(achievementIds).not.toContain(firstCourseId);
  });

  it("never revokes rewards when the source events are gone", async () => {
    for (let index = 0; index < 5; index++) await completeLesson(student.id);
    await evaluate(student.id);
    await db.delete(outboxEvents);

    expect(await evaluate(student.id)).toBe(0);
    expect(await getProfile(student.id)).toMatchObject({
      lifetimeXp: xpFor("first_lesson") + xpFor("lessons_completed"),
    });

    const [progress] = await db
      .select({ value: userAchievementProgress.value })
      .from(userAchievementProgress)
      .where(
        and(
          eq(userAchievementProgress.userId, student.id),
          eq(userAchievementProgress.achievementId, await getAchievementId("lessons_completed")),
        ),
      );

    expect(progress.value).toBe(5);
  });

  it("grants once when the same user is evaluated concurrently", async () => {
    for (let index = 0; index < 5; index++) await completeLesson(student.id);

    const results = await Promise.all([evaluate(student.id), evaluate(student.id)]);
    const expectedXp = xpFor("first_lesson") + xpFor("lessons_completed");

    expect(results[0] + results[1]).toBe(expectedXp);
    expect(await getProfile(student.id)).toMatchObject({ lifetimeXp: expectedXp });
  });

  it("backfills past activity for active users when the tenant is recalculated", async () => {
    const otherStudent = await userFactory.withUserSettings(db).create();
    const archivedStudent = await userFactory.withUserSettings(db).create();

    await db.update(users).set({ archived: true }).where(eq(users.id, archivedStudent.id));
    for (const user of [student, otherStudent, archivedStudent]) await completeLesson(user.id);

    await runAsTenant(() => gamificationService.recalculateTenant());

    expect(await getProfile(student.id)).toMatchObject({ lifetimeXp: xpFor("first_lesson") });
    expect(await getProfile(otherStudent.id)).toMatchObject({ lifetimeXp: xpFor("first_lesson") });
    expect(await getProfile(archivedStudent.id)).toBeUndefined();
  });

  it("returns the user's own profile with progress and hides unearned hidden achievements", async () => {
    const hiddenId = await getAchievementId("perfect_quiz");
    const lessonsCompletedId = await getAchievementId("lessons_completed");

    await updateAchievement("perfect_quiz", { visibility: ACHIEVEMENT_VISIBILITY.HIDDEN });
    await completeLesson(student.id);
    await completeLesson(student.id);
    await evaluate(student.id);

    const { body } = await fetchProfile(student, student.id);
    const { data } = body;

    expect(data).toMatchObject({
      userId: student.id,
      lifetimeXp: xpFor("first_lesson"),
      level: 1,
      nextLevelXp: 100,
    });
    expect(data.achievements.map(({ id }: { id: string }) => id)).not.toContain(hiddenId);

    const lessonsCompleted = data.achievements.find(
      ({ id }: { id: string }) => id === lessonsCompletedId,
    );

    expect(lessonsCompleted.progress).toBe(2);
    expect(lessonsCompleted.levels[0]).toMatchObject({ threshold: 5, earnedAt: null });
    expect(data.recentRewards).toEqual([
      expect.objectContaining({ level: 1, xpReward: xpFor("first_lesson") }),
    ]);
  });

  it("rejects reading another user's profile", async () => {
    const viewer = await userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create();

    await fetchProfile(viewer, student.id, 403);
  });
});
