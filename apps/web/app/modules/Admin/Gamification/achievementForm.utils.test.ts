import {
  ACHIEVEMENT_MAX_WINDOW_DAYS,
  ACHIEVEMENT_MAX_XP_REWARD,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_TEXT_MAX_LENGTH,
  GAMIFICATION_EVENT_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

import {
  createAchievementFormSchema,
  getDefaultAchievementFormValues,
  toAchievementBody,
} from "./achievementForm.utils";

import type { TFunction } from "i18next";

const t = ((key: string) => key) as TFunction;
const schema = createAchievementFormSchema(t);

const level = (threshold: number, xpReward: number, badgeImageKey: string | null = null) => ({
  threshold,
  xpReward,
  badgeImageKey,
  badgeImageUrl: badgeImageKey && `https://cdn.test/${badgeImageKey}`,
});

const values = (overrides: Partial<ReturnType<typeof getDefaultAchievementFormValues>> = {}) => ({
  ...getDefaultAchievementFormValues(SUPPORTED_LANGUAGES.EN),
  title: { en: "Lesson hero" },
  ...overrides,
});

describe("toAchievementBody", () => {
  it("keeps only filters the selected event supports", () => {
    const body = toAchievementBody(
      values({
        eventType: GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED,
        courseId: "course-1",
        minScore: 80,
      }),
    );

    expect(body.filters).toEqual({ courseId: "course-1" });
  });

  it("keeps a zero minimum score for quiz events", () => {
    const body = toAchievementBody(
      values({ eventType: GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED, minScore: 0 }),
    );

    expect(body.filters).toEqual({ minScore: 0 });
  });

  it("sends the window length only for time-window achievements", () => {
    expect(toAchievementBody(values({ windowDays: 7 })).windowDays).toBeNull();
    expect(
      toAchievementBody(
        values({ requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW, windowDays: 7 }),
      ).windowDays,
    ).toBe(7);
  });

  it("collapses first-time achievements to a single level at threshold 1", () => {
    const body = toAchievementBody(
      values({
        requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME,
        levels: [level(3, 25, "tenant/achievement-badges/first.png"), level(6, 50)],
      }),
    );

    expect(body.levels).toEqual([
      { threshold: 1, xpReward: 25, badgeImageKey: "tenant/achievement-badges/first.png" },
    ]);
  });

  it("sends each level's uploaded badge key without its preview URL", () => {
    const body = toAchievementBody(
      values({ levels: [level(1, 10), level(5, 20, "tenant/achievement-badges/second.png")] }),
    );

    expect(body.levels).toEqual([
      { threshold: 1, xpReward: 10, badgeImageKey: null },
      { threshold: 5, xpReward: 20, badgeImageKey: "tenant/achievement-badges/second.png" },
    ]);
  });
});

describe("createAchievementFormSchema", () => {
  it("requires a title in the base language", () => {
    const result = schema.safeParse(values({ title: { pl: "Bohater lekcji" } }));

    expect(result.success).toBe(false);
  });

  it("requires ascending level thresholds", () => {
    const result = schema.safeParse(
      values({
        levels: [level(5, 10), level(5, 20)],
      }),
    );

    expect(result.success).toBe(false);
  });

  it("requires a window length for time-window achievements", () => {
    const result = schema.safeParse(
      values({ requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW }),
    );

    expect(result.success).toBe(false);
  });

  it("treats untouched translation inputs as empty, not invalid", () => {
    const result = schema.safeParse(
      values({ title: { en: "Lesson hero", pl: undefined }, description: { en: undefined } }),
    );

    expect(result.success).toBe(true);
  });

  it("reports a missing base-language name with a readable message", () => {
    const result = schema.safeParse(values({ title: { en: undefined } }));

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["title", "en"],
        message: "gamification.admin.validation.titleRequired",
      }),
    ]);
  });

  it("rejects a minimum quiz score above 100", () => {
    expect(
      schema.safeParse(
        values({ eventType: GAMIFICATION_EVENT_TYPES.QUIZ_COMPLETED, minScore: 101 }),
      ).success,
    ).toBe(false);
  });

  it("ignores fields the form hides for the chosen event and requirement", () => {
    const hidden = values({
      eventType: GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED,
      minScore: 101,
      requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME,
      levels: [level(0, 10), level(0, 20)],
    });

    expect(schema.safeParse(hidden).success).toBe(true);
  });

  it.each([
    [
      "a fractional window",
      { requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW, windowDays: 1.5 },
    ],
    [
      "a window longer than the API allows",
      {
        requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW,
        windowDays: ACHIEVEMENT_MAX_WINDOW_DAYS + 1,
      },
    ],
    ["an XP reward above the API limit", { levels: [level(1, ACHIEVEMENT_MAX_XP_REWARD + 1)] }],
    [
      "a name longer than the API allows",
      { title: { en: "a".repeat(ACHIEVEMENT_TEXT_MAX_LENGTH + 1) } },
    ],
  ])("rejects %s", (_case, overrides) => {
    expect(schema.safeParse(values(overrides)).success).toBe(false);
  });

  it("accepts a valid achievement", () => {
    expect(schema.safeParse(values()).success).toBe(true);
  });
});
