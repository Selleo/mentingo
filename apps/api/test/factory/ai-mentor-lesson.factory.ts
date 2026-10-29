import { faker } from "@faker-js/faker";
import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TEACHING_STYLE,
  AI_MENTOR_TYPE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import {
  aiJudgeBlockingErrors,
  aiJudgeConfigurations,
  aiJudgeCriteria,
  aiJudgeScoreGuidance,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  aiMentorTeacherConfigurations,
} from "src/storage/schema";

import type { LocalizedText } from "@repo/shared";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AiMentorLessonTest = Omit<
  InferInsertModel<typeof aiMentorLessons>,
  "tenantId" | "name"
> & {
  name: LocalizedText;
};

export type ConfiguredAiMentorLessonTest = {
  id: UUIDType;
  lessonId: UUIDType;
  localizedText: LocalizedText;
};

export const createAiMentorLessonFactory = (db: DatabasePg) =>
  Factory.define<AiMentorLessonTest, never, InferSelectModel<typeof aiMentorLessons>>(
    ({ onCreate }) => {
      onCreate(async (aiMentorLesson) => {
        const [inserted] = await db
          .insert(aiMentorLessons)
          .values({
            ...aiMentorLesson,
            name: buildJsonbFieldWithMultipleEntries(aiMentorLesson.name),
          })
          .returning();

        return inserted;
      });

      return {
        lessonId: "",
        name: { [SUPPORTED_LANGUAGES.EN]: faker.person.firstName() },
        avatarReference: null,
      };
    },
  );

/**
 * Seeds an AI mentor lesson with teacher, roleplay and judge configurations whose localized
 * fields all hold `localizedText`.
 */
export const createConfiguredAiMentorLessonFactory = (db: DatabasePg) =>
  Factory.define<ConfiguredAiMentorLessonTest, never, InferSelectModel<typeof aiMentorLessons>>(
    ({ onCreate }) => {
      onCreate(async ({ id, lessonId, localizedText }) => {
        const localizedJsonb = () => buildJsonbFieldWithMultipleEntries(localizedText);

        const [aiMentorLesson] = await db
          .insert(aiMentorLessons)
          .values({ id, lessonId, name: localizedJsonb() })
          .returning();

        const [configuration] = await db
          .insert(aiMentorConfigurations)
          .values({
            aiMentorLessonId: aiMentorLesson.id,
            type: AI_MENTOR_TYPE.TEACHER,
            openingInstruction: localizedJsonb(),
            additionalInstructions: localizedJsonb(),
          })
          .returning();

        await db.insert(aiMentorTeacherConfigurations).values({
          configurationId: configuration.id,
          taskGoal: localizedJsonb(),
          expertise: localizedJsonb(),
          contentScope: localizedJsonb(),
          feedbackGuidance: localizedJsonb(),
          teachingStyle: AI_MENTOR_TEACHING_STYLE.SOCRATIC,
        });

        await db.insert(aiMentorRoleplayConfigurations).values({
          configurationId: configuration.id,
          scenario: localizedJsonb(),
          aiRole: localizedJsonb(),
          learnerRole: localizedJsonb(),
          characterGoal: localizedJsonb(),
          factsAndConstraints: localizedJsonb(),
          difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
        });

        const [judgeConfiguration] = await db
          .insert(aiJudgeConfigurations)
          .values({
            aiMentorLessonId: aiMentorLesson.id,
            taskGoal: localizedJsonb(),
            passingThresholdPercent: 50,
          })
          .returning();

        const [criterion] = await db
          .insert(aiJudgeCriteria)
          .values({
            configurationId: judgeConfiguration.id,
            maxScore: 5,
            title: localizedJsonb(),
            expectedBehavior: localizedJsonb(),
          })
          .returning();

        await db.insert(aiJudgeScoreGuidance).values({
          criterionId: criterion.id,
          score: 5,
          description: localizedJsonb(),
          example: localizedJsonb(),
        });

        await db.insert(aiJudgeBlockingErrors).values({
          configurationId: judgeConfiguration.id,
          description: localizedJsonb(),
        });

        return aiMentorLesson;
      });

      return {
        id: faker.string.uuid(),
        lessonId: "",
        localizedText: { [SUPPORTED_LANGUAGES.EN]: faker.lorem.sentence() },
      };
    },
  );
