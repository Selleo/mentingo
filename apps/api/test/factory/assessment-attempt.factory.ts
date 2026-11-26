import { faker } from "@faker-js/faker";
import {
  ASSESSMENT_ATTEMPT_GRADING_STATUSES,
  ASSESSMENT_ATTEMPT_RESULTS,
  ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { assessmentAttempts, assessments } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AssessmentAttemptTest = Omit<
  InferInsertModel<typeof assessmentAttempts>,
  "tenantId" | "assessmentId"
> & { lessonId: UUIDType };

/** Seeds an assessment for the lesson together with one graded, passed attempt of the learner. */
export const createAssessmentAttemptFactory = (db: DatabasePg) =>
  Factory.define<AssessmentAttemptTest, never, InferSelectModel<typeof assessmentAttempts>>(
    ({ onCreate }) => {
      onCreate(async ({ lessonId, ...attempt }) => {
        const [assessment] = await db
          .insert(assessments)
          .values({
            lessonId,
            passingScorePercentage: "80",
            baseLanguage: SUPPORTED_LANGUAGES.EN,
            availableLocales: [SUPPORTED_LANGUAGES.EN],
          })
          .returning();

        const [inserted] = await db
          .insert(assessmentAttempts)
          .values({ ...attempt, assessmentId: assessment.id })
          .returning();

        return inserted;
      });

      return {
        id: faker.string.uuid(),
        lessonId: "",
        learnerId: "",
        language: SUPPORTED_LANGUAGES.EN,
        attemptNumber: 1,
        availablePoints: "1",
        awardedPoints: "1",
        scorePercentage: "100",
        submissionStatus: ASSESSMENT_ATTEMPT_SUBMISSION_STATUSES.SUBMITTED,
        gradingStatus: ASSESSMENT_ATTEMPT_GRADING_STATUSES.GRADED,
        result: ASSESSMENT_ATTEMPT_RESULTS.PASSED,
        submittedAt: new Date().toISOString(),
      };
    },
  );
