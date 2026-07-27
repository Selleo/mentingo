import { AI_JUDGE_MAX_CRITERION_SCORE } from "@repo/shared";
import { z } from "zod";

import { stripHtmlTags } from "~/utils/stripHtmlTags";

import type { TFunction } from "i18next";

export const aiJudgeGenerationBriefSchema = (t: TFunction) =>
  z.object({
    instruction: z
      .string()
      .refine(
        (value) => stripHtmlTags(value).trim().length > 0,
        t("adminCourseView.curriculum.lesson.aiJudge.generation.instructionRequired"),
      ),
  });

export const aiJudgeConfigurationSchema = (t: TFunction) =>
  z
    .object({
      id: z.string().optional(),
      taskGoal: z
        .string()
        .refine(
          (value) => stripHtmlTags(value).trim().length > 0,
          t("adminCourseView.curriculum.lesson.aiJudge.validation.taskGoalRequired"),
        ),
      passingThresholdPercent: z.coerce
        .number()
        .int()
        .min(0, t("adminCourseView.curriculum.lesson.aiJudge.validation.thresholdRange"))
        .max(100, t("adminCourseView.curriculum.lesson.aiJudge.validation.thresholdRange")),
      criteria: z.array(
        z
          .object({
            id: z.string().optional(),
            title: z
              .string()
              .trim()
              .min(1, t("adminCourseView.curriculum.lesson.aiJudge.validation.titleRequired")),
            expectedBehavior: z
              .string()
              .trim()
              .min(
                1,
                t("adminCourseView.curriculum.lesson.aiJudge.validation.expectedBehaviorRequired"),
              ),
            maxScore: z.coerce
              .number()
              .int()
              .min(1, t("adminCourseView.curriculum.lesson.aiJudge.validation.maxScoreRange"))
              .max(
                AI_JUDGE_MAX_CRITERION_SCORE,
                t("adminCourseView.curriculum.lesson.aiJudge.validation.maxScoreRange"),
              ),
            scoreGuidance: z
              .array(
                z.object({
                  id: z.string().optional(),
                  score: z.coerce
                    .number()
                    .int()
                    .min(0, t("adminCourseView.curriculum.lesson.aiJudge.validation.scoreRange")),
                  description: z
                    .string()
                    .trim()
                    .min(
                      1,
                      t("adminCourseView.curriculum.lesson.aiJudge.validation.guidanceRequired"),
                    ),
                  example: z.string().optional(),
                }),
              )
              .min(
                1,
                t("adminCourseView.curriculum.lesson.aiJudge.validation.completeGuidanceRequired"),
              ),
          })
          .superRefine((criterion, ctx) => {
            const scores = new Set<number>();

            criterion.scoreGuidance.forEach((guidance, index) => {
              if (guidance.score > criterion.maxScore) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t(
                    "adminCourseView.curriculum.lesson.aiJudge.validation.scoreExceedsMaximum",
                  ),
                  path: ["scoreGuidance", index, "score"],
                });
              }

              if (scores.has(guidance.score)) {
                ctx.addIssue({
                  code: z.ZodIssueCode.custom,
                  message: t(
                    "adminCourseView.curriculum.lesson.aiJudge.validation.scoreMustBeUnique",
                  ),
                  path: ["scoreGuidance", index, "score"],
                });
              }

              scores.add(guidance.score);
            });

            const hasEveryScore = Array.from(
              { length: criterion.maxScore + 1 },
              (_, score) => score,
            ).every((score) => scores.has(score));

            if (scores.size !== criterion.maxScore + 1 || !hasEveryScore) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t(
                  "adminCourseView.curriculum.lesson.aiJudge.validation.completeGuidanceRequired",
                ),
                path: ["scoreGuidance"],
              });
            }
          }),
      ),
      blockingErrors: z.array(
        z.object({
          id: z.string().optional(),
          description: z
            .string()
            .trim()
            .min(
              1,
              t("adminCourseView.curriculum.lesson.aiJudge.validation.blockingErrorRequired"),
            ),
        }),
      ),
    })
    .transform((value) => ({
      ...value,
      criteria: value.criteria.map((criterion) => ({
        ...criterion,
        scoreGuidance: criterion.scoreGuidance.map((guidance) => ({
          ...guidance,
          example: guidance.example?.trim() || undefined,
        })),
      })),
    }));
