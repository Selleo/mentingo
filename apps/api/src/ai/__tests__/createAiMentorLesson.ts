import { faker } from "@faker-js/faker";
import {
  AI_MENTOR_ROLEPLAY_DIFFICULTY,
  AI_MENTOR_TTS_PRESET,
  AI_MENTOR_TYPE,
  AI_MENTOR_VOICE_MODE,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  aiJudgeConfigurations,
  aiMentorConfigurations,
  aiMentorLessons,
  aiMentorRoleplayConfigurations,
  lessons,
} from "src/storage/schema";

import { createChapterFactory } from "../../../test/factory/chapter.factory";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AiMentorLessonTest = Omit<
  InferSelectModel<typeof aiMentorLessons>,
  "tenantId" | "name"
> & {
  additionalInstructions: string;
  taskGoal: string;
  name: string;
};

const ensureChapter = async (db: DatabasePg, chapterId?: UUIDType) => {
  if (chapterId) return chapterId;

  const chapterFactory = createChapterFactory(db);
  const chapter = await chapterFactory.create();

  return chapter.id;
};

export const createAiMentorLessonFactory = (db: DatabasePg) => {
  return Factory.define<AiMentorLessonTest>(({ onCreate }) => {
    onCreate(async (aiMentorLesson) => {
      const chapterId = await ensureChapter(db);

      const [lesson] = await db
        .insert(lessons)
        .values({
          chapterId,
          type: LESSON_TYPES.AI_MENTOR,
          title: buildJsonbField(SUPPORTED_LANGUAGES.EN, faker.commerce.productName()),
          isExternal: true,
        })
        .returning();

      const [createdAiMentorLesson] = await db
        .insert(aiMentorLessons)
        .values({
          lessonId: lesson.id,
          name: buildJsonbField(SUPPORTED_LANGUAGES.EN, aiMentorLesson.name),
          voiceMode: aiMentorLesson.voiceMode,
          ttsPreset: aiMentorLesson.ttsPreset,
          customTtsReference: aiMentorLesson.customTtsReference,
        })
        .returning();

      const [mentorConfiguration] = await db
        .insert(aiMentorConfigurations)
        .values({
          aiMentorLessonId: createdAiMentorLesson.id,
          type: AI_MENTOR_TYPE.ROLEPLAY,
          additionalInstructions: buildJsonbField(
            SUPPORTED_LANGUAGES.EN,
            aiMentorLesson.additionalInstructions,
          ),
        })
        .returning();

      await db.insert(aiMentorRoleplayConfigurations).values({
        configurationId: mentorConfiguration.id,
        difficulty: AI_MENTOR_ROLEPLAY_DIFFICULTY.REALISTIC,
      });

      await db.insert(aiJudgeConfigurations).values({
        aiMentorLessonId: createdAiMentorLesson.id,
        taskGoal: buildJsonbField(SUPPORTED_LANGUAGES.EN, aiMentorLesson.taskGoal),
        passingThresholdPercent: 0,
      });

      return {
        ...createdAiMentorLesson,
        additionalInstructions: aiMentorLesson.additionalInstructions,
        taskGoal: aiMentorLesson.taskGoal,
        name: aiMentorLesson.name,
      };
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lessonId: faker.string.uuid(),
      additionalInstructions: faker.commerce.productDescription(),
      taskGoal: faker.commerce.productDescription(),
      name: "AI Mentor",
      avatarReference: null,
      voiceMode: AI_MENTOR_VOICE_MODE.PRESET,
      ttsPreset: AI_MENTOR_TTS_PRESET.MALE,
      customTtsReference: null,
    };
  });
};
