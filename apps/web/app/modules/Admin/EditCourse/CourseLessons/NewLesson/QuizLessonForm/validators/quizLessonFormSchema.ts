import { ASSESSMENT_SCORING_MODES, ASSESSMENT_TIME_LIMIT_MINUTES } from "@repo/shared";
import { z } from "zod";

import { QuestionType } from "../QuizLessonForm.types";

export const quizLessonFormSchema = (
  t: (key: string, options?: Record<string, unknown>) => string,
) => {
  const timeLimitMessage = t("adminCourseView.curriculum.lesson.validation.timeLimitMinutes", {
    min: ASSESSMENT_TIME_LIMIT_MINUTES.MIN,
    max: ASSESSMENT_TIME_LIMIT_MINUTES.MAX,
  });

  return z.object({
    title: z
      .string()
      .min(2, t("adminCourseView.curriculum.lesson.validation.titleMinLength"))
      .max(250, t("adminCourseView.curriculum.lesson.validation.titleMaxLength")),
    thresholdScore: z.union([z.number().min(0).max(100), z.null()]).optional(),
    attemptsLimit: z.union([z.number().min(1).max(100), z.null()]).optional(),
    quizCooldownInHours: z.union([z.number().min(1).max(720), z.null()]).optional(),
    timeLimitMinutes: z
      .union([
        z
          .number()
          .int(timeLimitMessage)
          .min(ASSESSMENT_TIME_LIMIT_MINUTES.MIN, timeLimitMessage)
          .max(ASSESSMENT_TIME_LIMIT_MINUTES.MAX, timeLimitMessage),
        z.null(),
      ])
      .optional(),
    questions: z
      .array(
        z.object({
          id: z.string().optional(),
          sortableId: z.string(),
          type: z.nativeEnum(QuestionType),
          description: z.optional(z.string()),
          photoS3Key: z.optional(z.string()),
          requiresReview: z.optional(z.boolean()),
          displayOrder: z.number(),
          thumbnailS3: z.optional(
            z.object({
              value: z.string(),
              key: z.string(),
            }),
          ),
          title: z
            .string()
            .min(2, t("adminCourseView.curriculum.lesson.validation.titleMinLength"))
            .max(250, t("adminCourseView.curriculum.lesson.validation.titleMaxLength")),
          scoringMode: z.optional(z.nativeEnum(ASSESSMENT_SCORING_MODES)),
          options: z
            .array(
              z.object({
                id: z.string().optional(),
                sortableId: z.string(),
                optionText: z
                  .string()
                  .min(1, t("adminCourseView.curriculum.lesson.validation.optionTextRequired"))
                  .max(250, t("adminCourseView.curriculum.lesson.validation.optionTextMaxLength")),
                isCorrect: z.boolean(),
                displayOrder: z.number(),
                matchedWord: z.optional(z.string()),
                scaleAnswer: z.optional(z.number()),
              }),
            )
            .optional(),
        }),
      )
      .superRefine((questions, ctx) => {
        questions.forEach((question, index) => {
          if (
            question.type !== QuestionType.BRIEF_RESPONSE &&
            question.type !== QuestionType.DETAILED_RESPONSE &&
            (!question.options || question.options.length === 0)
          ) {
            ctx.addIssue({
              path: [index, "options"],
              message: t("adminCourseView.curriculum.lesson.validation.atLeastOneOptionRequired"),
              code: z.ZodIssueCode.custom,
            });
          }

          if (question.type === QuestionType.MATCHING && (question.options?.length ?? 0) < 2) {
            ctx.addIssue({
              path: [index, "options"],
              message: t("adminCourseView.curriculum.lesson.validation.matchingPairsRequired"),
              code: z.ZodIssueCode.custom,
            });
          }

          // Matching errors stay on pair fields: an issue on the whole options list would hide them.
          if (question.type === QuestionType.MATCHING) {
            const matches = question.options?.map((option) => option.matchedWord?.trim()) ?? [];

            question.options?.forEach((option, optionIndex) => {
              const match = matches[optionIndex];

              // The API trims prompts, so a whitespace-only prompt is empty.
              if (option.optionText && !option.optionText.trim())
                ctx.addIssue({
                  path: [index, "options", optionIndex, "optionText"],
                  message: t("adminCourseView.curriculum.lesson.validation.optionTextRequired"),
                  code: z.ZodIssueCode.custom,
                });

              if (!match)
                ctx.addIssue({
                  path: [index, "options", optionIndex, "matchedWord"],
                  message: t("adminCourseView.curriculum.lesson.validation.matchingMatchRequired"),
                  code: z.ZodIssueCode.custom,
                });
              else if (matches.indexOf(match) !== matches.lastIndexOf(match))
                ctx.addIssue({
                  path: [index, "options", optionIndex, "matchedWord"],
                  message: t("adminCourseView.curriculum.lesson.validation.matchingPairsUnique"),
                  code: z.ZodIssueCode.custom,
                });
            });
          }

          if (
            (question.type === QuestionType.PHOTO_QUESTION_SINGLE_CHOICE ||
              question.type === QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE) &&
            !question.photoS3Key
          ) {
            ctx.addIssue({
              path: [index, "photoS3Key"],
              message: t("adminCourseView.curriculum.lesson.validation.imageRequired"),
              code: z.ZodIssueCode.custom,
            });
          }
          if (
            (question.type === QuestionType.FILL_IN_THE_BLANKS_DND ||
              question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) &&
            (question?.description?.replace(/<\/?[^>]+(>|$)/g, "")?.length ?? 0) < 10
          ) {
            ctx.addIssue({
              path: [index, "description"],
              message: t("adminCourseView.curriculum.lesson.validation.descriptionLength"),
              code: z.ZodIssueCode.custom,
            });
          }
          if (
            (question.type === QuestionType.SINGLE_CHOICE ||
              question.type === QuestionType.PHOTO_QUESTION_SINGLE_CHOICE ||
              question.type === QuestionType.MULTIPLE_CHOICE ||
              question.type === QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE ||
              question.type === QuestionType.FILL_IN_THE_BLANKS_DND ||
              question.type === QuestionType.FILL_IN_THE_BLANKS_TEXT) &&
            (!question.options || !question.options.some((option) => option.isCorrect === true))
          ) {
            ctx.addIssue({
              path: [index, "options"],
              message: t("adminCourseView.curriculum.lesson.validation.atLeastOneOptionCorrect"),
              code: z.ZodIssueCode.custom,
            });
          }
        });
      }),
  });
};

export type QuizLessonFormValues = z.infer<ReturnType<typeof quizLessonFormSchema>>;
