import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_FEEDBACK_MODES,
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import {
  assessmentFeedbackRanges,
  assessmentQuestionChoiceOptions,
  assessmentQuestions,
  assessments,
} from "src/storage/schema";

import type { AssessmentFeedbackMode } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ChoiceOptionTest = { label: string; isCorrect: boolean };

export type QuizAssessmentTest = {
  id: UUIDType;
  lessonId: UUIDType;
  passingScorePercentage: string;
  feedbackMode: AssessmentFeedbackMode;
  choiceQuestion: { title: string; options: ChoiceOptionTest[] };
};

export type SeededQuizAssessment = {
  assessment: InferSelectModel<typeof assessments>;
  question: InferSelectModel<typeof assessmentQuestions>;
  options: InferSelectModel<typeof assessmentQuestionChoiceOptions>[];
};

/** Seeds an English assessment for the lesson with one automatically graded single-choice question. */
export const createQuizAssessmentFactory = (db: DatabasePg) =>
  Factory.define<QuizAssessmentTest, never, SeededQuizAssessment>(({ onCreate }) => {
    onCreate(async ({ id, lessonId, passingScorePercentage, feedbackMode, choiceQuestion }) => {
      const [assessment] = await db
        .insert(assessments)
        .values({
          id,
          lessonId,
          passingScorePercentage,
          feedbackMode,
          baseLanguage: SUPPORTED_LANGUAGES.EN,
          availableLocales: [SUPPORTED_LANGUAGES.EN],
        })
        .returning();

      const localizedTitle = buildJsonbFieldWithMultipleEntries({
        [SUPPORTED_LANGUAGES.EN]: choiceQuestion.title,
      });

      const [question] = await db
        .insert(assessmentQuestions)
        .values({
          assessmentId: assessment.id,
          questionType: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
          gradingMode: ASSESSMENT_GRADING_MODES.AUTOMATIC,
          displayOrder: 1,
          prompt: localizedTitle,
          title: localizedTitle,
        })
        .returning();

      const options = await db
        .insert(assessmentQuestionChoiceOptions)
        .values(
          choiceQuestion.options.map(({ label, isCorrect }, index) => ({
            questionId: question.id,
            language: SUPPORTED_LANGUAGES.EN,
            displayOrder: index + 1,
            isCorrect,
            label,
          })),
        )
        .returning();

      return { assessment, question, options };
    });

    return {
      id: faker.string.uuid(),
      lessonId: "",
      passingScorePercentage: "70",
      feedbackMode: ASSESSMENT_FEEDBACK_MODES.FULL,
      choiceQuestion: {
        title: "What is 2+2?",
        options: [
          { label: "3", isCorrect: false },
          { label: "4", isCorrect: true },
          { label: "5", isCorrect: false },
        ],
      },
    };
  });

export type OpenTextQuestionTest = {
  id: UUIDType;
  assessmentId: UUIDType;
  title: string;
  displayOrder: number;
};

/** Seeds a brief-response question that a reviewer grades manually. */
export const createOpenTextQuestionFactory = (db: DatabasePg) =>
  Factory.define<OpenTextQuestionTest, never, InferSelectModel<typeof assessmentQuestions>>(
    ({ onCreate }) => {
      onCreate(async ({ id, assessmentId, title, displayOrder }) => {
        const localizedTitle = buildJsonbFieldWithMultipleEntries({
          [SUPPORTED_LANGUAGES.EN]: title,
        });

        const [question] = await db
          .insert(assessmentQuestions)
          .values({
            id,
            assessmentId,
            questionType: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE,
            gradingMode: ASSESSMENT_GRADING_MODES.MANUAL,
            maximumPoints: "1",
            displayOrder,
            prompt: localizedTitle,
            title: localizedTitle,
          })
          .returning();

        return question;
      });

      return {
        id: faker.string.uuid(),
        assessmentId: "",
        title: "Explain",
        displayOrder: 99,
      };
    },
  );

export type AssessmentFeedbackRangeTest = {
  assessmentId: UUIDType;
  minPercent: number;
  maxPercent: number;
  displayOrder: number;
  message: string;
};

export const createAssessmentFeedbackRangeFactory = (db: DatabasePg) =>
  Factory.define<
    AssessmentFeedbackRangeTest,
    never,
    InferSelectModel<typeof assessmentFeedbackRanges>
  >(({ onCreate }) => {
    onCreate(async ({ message, ...range }) => {
      const [inserted] = await db
        .insert(assessmentFeedbackRanges)
        .values({
          ...range,
          message: buildJsonbFieldWithMultipleEntries({ [SUPPORTED_LANGUAGES.EN]: message }),
        })
        .returning();

      return inserted;
    });

    return {
      assessmentId: "",
      minPercent: 0,
      maxPercent: 100,
      displayOrder: 0,
      message: faker.lorem.sentence(),
    };
  });
