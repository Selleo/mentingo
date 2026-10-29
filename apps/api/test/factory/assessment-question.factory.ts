import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_GRADING_MODES,
  ASSESSMENT_QUESTION_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import {
  assessmentQuestionChoiceOptions,
  assessmentQuestions,
  assessments,
} from "src/storage/schema";

import type { LocalizedText, SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AssessmentQuestionTest = {
  id: UUIDType;
  lessonId: UUIDType;
  title: LocalizedText;
  description: LocalizedText;
  choiceOptionLabels: Partial<Record<SupportedLanguages, string>>;
};

/** Seeds an assessment for the lesson with one choice question and one option per language. */
export const createAssessmentQuestionFactory = (db: DatabasePg) =>
  Factory.define<AssessmentQuestionTest, never, InferSelectModel<typeof assessmentQuestions>>(
    ({ onCreate }) => {
      onCreate(async (question) => {
        const [assessment] = await db
          .insert(assessments)
          .values({ lessonId: question.lessonId, passingScorePercentage: "50" })
          .returning();

        const [inserted] = await db
          .insert(assessmentQuestions)
          .values({
            id: question.id,
            assessmentId: assessment.id,
            questionType: ASSESSMENT_QUESTION_TYPES.SINGLE_CHOICE,
            gradingMode: ASSESSMENT_GRADING_MODES.AUTOMATIC,
            displayOrder: 1,
            title: buildJsonbFieldWithMultipleEntries(question.title),
            description: buildJsonbFieldWithMultipleEntries(question.description),
          })
          .returning();

        const choiceOptions = Object.entries(question.choiceOptionLabels).map(
          ([language, label]) => ({
            questionId: inserted.id,
            language: language as SupportedLanguages,
            displayOrder: 1,
            isCorrect: true,
            label,
          }),
        );

        if (choiceOptions.length) {
          await db.insert(assessmentQuestionChoiceOptions).values(choiceOptions);
        }

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        lessonId: "",
        title: { [SUPPORTED_LANGUAGES.EN]: faker.lorem.sentence() },
        description: { [SUPPORTED_LANGUAGES.EN]: faker.lorem.sentence() },
        choiceOptionLabels: { [SUPPORTED_LANGUAGES.EN]: faker.lorem.word() },
      };
    },
  );
