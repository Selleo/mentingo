import { z } from "zod";

import type i18next from "i18next";

export const QuizFormSchema = (t: typeof i18next.t) =>
  z
    .object({
      briefResponses: z
        .record(z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")))
        .optional(),
      detailedResponses: z
        .record(z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")))
        .optional(),
      singleAnswerQuestions: z
        .record(
          z.record(
            z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")).nullable(),
          ),
        )
        .optional(),
      multiAnswerQuestions: z.record(z.record(z.string().nullable())).optional(),
      photoQuestionSingleChoice: z
        .record(
          z.record(
            z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")).nullable(),
          ),
        )
        .optional(),
      photoQuestionMultipleChoice: z.record(z.record(z.string().nullable())).optional(),
      trueOrFalseQuestions: z
        .record(
          z.record(
            z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")).nullable(),
          ),
        )
        .optional(),
      fillInTheBlanksText: z
        .record(
          z.record(
            z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")).nullable(),
          ),
        )
        .optional(),
      fillInTheBlanksDnd: z
        .record(
          z.record(
            z.string().min(1, t("studentLessonView.validation.answerCannotBeEmpty")).nullable(),
          ),
        )
        .optional(),
    })
    .superRefine((data, ctx) => {
      const requiredFields = {
        multipleChoice: "multiAnswerQuestions",
        photoQuestionMultipleChoice: "photoQuestionMultipleChoice",
      };
      for (const [_, fieldName] of Object.entries(requiredFields)) {
        const fieldData = data[fieldName as keyof typeof data];
        if (fieldData) {
          Object.entries(fieldData).forEach(([questionId, answers]) => {
            const isValid = Object.values(answers).some(
              (value) => typeof value === "string" && value.trim() !== "",
            );
            if (!isValid) {
              ctx.addIssue({
                code: "custom",
                path: [fieldName, questionId],
                message: t("studentLessonView.validation.atLeastOneOptionMustBeSelected", {
                  questionId,
                }),
              });
            }
          });
        }
      }

      const fillInTheBlanksDnd = data.fillInTheBlanksDnd;
      if (fillInTheBlanksDnd) {
        Object.entries(fillInTheBlanksDnd).forEach(([questionId, answer]) => {
          if (!answer) {
            ctx.addIssue({
              code: "custom",
              path: ["fillInTheBlanksDnd", questionId],
              message: t("studentLessonView.validation.answerCannotBeEmptyForDragAndDropQuestion", {
                questionId,
              }),
            });
          }
        });
      }

      const fillInTheBlanksText = data.fillInTheBlanksText;
      if (fillInTheBlanksText) {
        Object.entries(fillInTheBlanksText).forEach(([questionId, answer]) => {
          if (!answer) {
            ctx.addIssue({
              code: "custom",
              path: ["fillInTheBlanksText", questionId],
              message: t("studentLessonView.validation.answerCannotBeEmptyForTextQuestion", {
                questionId,
              }),
            });
          }
        });
      }

      const trueOrFalseQuestions = data.trueOrFalseQuestions;
      if (trueOrFalseQuestions) {
        Object.entries(trueOrFalseQuestions).forEach(([questionId, answers]) => {
          const isValid = Object.values(answers).every(
            (value) => value === "true" || value === "false",
          );

          if (!isValid) {
            ctx.addIssue({
              code: "custom",
              path: ["trueOrFalseQuestions", questionId],
              message: t("studentLessonView.validation.answerCannotBeEmpty"),
            });
          }
        });
      }
    });
