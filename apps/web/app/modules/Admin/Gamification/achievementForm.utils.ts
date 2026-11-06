import {
  ACHIEVEMENT_ICONS,
  ACHIEVEMENT_MAX_LEVELS,
  ACHIEVEMENT_MAX_WINDOW_DAYS,
  ACHIEVEMENT_MAX_XP_REWARD,
  ACHIEVEMENT_TEXT_MAX_LENGTH,
  ACHIEVEMENT_FILTER_KEYS,
  ACHIEVEMENT_REQUIREMENT_TYPES,
  ACHIEVEMENT_VISIBILITY,
  GAMIFICATION_EVENT_FILTERS,
  GAMIFICATION_EVENT_TYPES,
  DEFAULT_ACHIEVEMENT_ICON,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { z } from "zod";

import type { GamificationEventType, SupportedLanguages } from "@repo/shared";
import type { TFunction } from "i18next";
import type { CreateAchievementBody, GetAdminAchievementResponse } from "~/api/generated-api";

type AdminAchievementDetails = GetAdminAchievementResponse["data"];

const nullableNumber = z.number().nullable();

const isIntegerBetween = (value: number | null, min: number, max: number): value is number =>
  value !== null && Number.isInteger(value) && value >= min && value <= max;

const xpRewardMessage = (t: TFunction) =>
  t("gamification.admin.validation.xpReward", { max: ACHIEVEMENT_MAX_XP_REWARD });

export const createAchievementFormSchema = (t: TFunction) => {
  const translation = z
    .string()
    .max(
      ACHIEVEMENT_TEXT_MAX_LENGTH,
      t("gamification.admin.validation.textTooLong", { max: ACHIEVEMENT_TEXT_MAX_LENGTH }),
    )
    .optional();

  return z
    .object({
      // A registered but untouched translation input holds undefined; that is an empty translation,
      // not an error (a type error here would surface as an "undefined" message under the field).
      title: z.record(translation),
      description: z.record(translation),
      baseLanguage: z.nativeEnum(SUPPORTED_LANGUAGES),
      eventType: z.nativeEnum(GAMIFICATION_EVENT_TYPES),
      requirementType: z.nativeEnum(ACHIEVEMENT_REQUIREMENT_TYPES),
      windowDays: nullableNumber,
      courseId: z.string().nullable(),
      minScore: nullableNumber,
      visibility: z.nativeEnum(ACHIEVEMENT_VISIBILITY),
      isEnabled: z.boolean(),
      icon: z.nativeEnum(ACHIEVEMENT_ICONS),
      levels: z
        .array(
          z.object({
            threshold: z.number(),
            xpReward: z
              .number()
              .int(xpRewardMessage(t))
              .min(0, xpRewardMessage(t))
              .max(ACHIEVEMENT_MAX_XP_REWARD, xpRewardMessage(t)),
            badgeImageKey: z.string().nullable(),
            badgeImageUrl: z.string().nullable(),
          }),
        )
        .min(1)
        .max(ACHIEVEMENT_MAX_LEVELS),
    })
    .superRefine((values, context) => {
      if (!values.title[values.baseLanguage]?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          // On the language's own input: a parent "title" error is filed under title.root by RHF.
          path: ["title", values.baseLanguage],
          message: t("gamification.admin.validation.titleRequired"),
        });
      }

      // Fields the form hides for the chosen event or requirement are dropped on submit, so they
      // are only validated while visible; a leftover value must not block saving.
      if (
        values.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW &&
        !isIntegerBetween(values.windowDays, 1, ACHIEVEMENT_MAX_WINDOW_DAYS)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["windowDays"],
          message: t("gamification.admin.validation.windowDays", {
            max: ACHIEVEMENT_MAX_WINDOW_DAYS,
          }),
        });
      }

      if (
        supportsFilter(values.eventType, ACHIEVEMENT_FILTER_KEYS.MIN_SCORE) &&
        values.minScore !== null &&
        !(values.minScore >= 0 && values.minScore <= 100)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["minScore"],
          message: t("gamification.admin.validation.minScore"),
        });
      }

      if (values.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME) return;

      values.levels.forEach((level, index) => {
        const previous = values.levels[index - 1];

        if (!isIntegerBetween(level.threshold, 1, Number.MAX_SAFE_INTEGER)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["levels", index, "threshold"],
            message: t("gamification.admin.validation.threshold"),
          });
        } else if (previous && level.threshold <= previous.threshold) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["levels", index, "threshold"],
            message: t("gamification.admin.validation.thresholdsAscending"),
          });
        }
      });
    });
};

export type AchievementFormValues = z.infer<ReturnType<typeof createAchievementFormSchema>>;

export const supportsFilter = (
  eventType: GamificationEventType,
  filter: (typeof ACHIEVEMENT_FILTER_KEYS)[keyof typeof ACHIEVEMENT_FILTER_KEYS],
) => GAMIFICATION_EVENT_FILTERS[eventType].includes(filter);

export const getDefaultAchievementFormValues = (
  language: SupportedLanguages,
): AchievementFormValues => ({
  title: {},
  description: {},
  baseLanguage: language,
  eventType: GAMIFICATION_EVENT_TYPES.LESSON_COMPLETED,
  requirementType: ACHIEVEMENT_REQUIREMENT_TYPES.COUNT,
  windowDays: null,
  courseId: null,
  minScore: null,
  visibility: ACHIEVEMENT_VISIBILITY.VISIBLE,
  isEnabled: true,
  icon: DEFAULT_ACHIEVEMENT_ICON,
  levels: [{ threshold: 1, xpReward: 10, badgeImageKey: null, badgeImageUrl: null }],
});

export const toAchievementFormValues = (
  achievement: AdminAchievementDetails,
): AchievementFormValues => ({
  title: achievement.title,
  description: achievement.description,
  baseLanguage: achievement.baseLanguage,
  eventType: achievement.eventType,
  requirementType: achievement.requirementType,
  windowDays: achievement.windowDays,
  courseId: achievement.filters.courseId ?? null,
  minScore: achievement.filters.minScore ?? null,
  visibility: achievement.visibility,
  isEnabled: achievement.isEnabled,
  icon: achievement.icon,
  levels: achievement.levels.map(({ threshold, xpReward, badgeImageKey, badgeImageUrl }) => ({
    threshold,
    xpReward,
    badgeImageKey,
    badgeImageUrl,
  })),
});

/** Drops fields the selected event or requirement type cannot use, so hidden inputs never leak into the request. */
export const toAchievementBody = (values: AchievementFormValues): CreateAchievementBody => {
  const isFirstTime = values.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.FIRST_TIME;
  const isTimeWindow = values.requirementType === ACHIEVEMENT_REQUIREMENT_TYPES.TIME_WINDOW;
  const [firstLevel] = values.levels;

  return {
    title: values.title,
    description: values.description,
    baseLanguage: values.baseLanguage,
    eventType: values.eventType,
    requirementType: values.requirementType,
    windowDays: isTimeWindow ? values.windowDays : null,
    filters: {
      ...(values.courseId &&
        supportsFilter(values.eventType, ACHIEVEMENT_FILTER_KEYS.COURSE_ID) && {
          courseId: values.courseId,
        }),
      ...(values.minScore !== null &&
        supportsFilter(values.eventType, ACHIEVEMENT_FILTER_KEYS.MIN_SCORE) && {
          minScore: values.minScore,
        }),
    },
    visibility: values.visibility,
    isEnabled: values.isEnabled,
    icon: values.icon,
    levels: isFirstTime
      ? [
          {
            threshold: 1,
            xpReward: firstLevel?.xpReward ?? 0,
            badgeImageKey: firstLevel?.badgeImageKey ?? null,
          },
        ]
      : values.levels.map(({ threshold, xpReward, badgeImageKey }) => ({
          threshold,
          xpReward,
          badgeImageKey,
        })),
  };
};
