import { faker } from "@faker-js/faker";
import { AI_MENTOR_TTS_PRESET, AI_MENTOR_VOICE_MODE, DEFAULT_AI_MENTOR_TYPE } from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { aiJudgeConfigurations, aiMentorLessons, lessons } from "src/storage/schema";

import { createChapterFactory } from "../../../test/factory/chapter.factory";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AiMentorLessonTest = Omit<
  InferSelectModel<typeof aiMentorLessons>,
  "tenantId" | "aiMentorInstructions" | "name"
> & {
  aiMentorInstructions: string;
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
          title: buildJsonbField("en", faker.commerce.productName()),
          isExternal: true,
        })
        .returning();

      const [createdAiMentorLesson] = await db
        .insert(aiMentorLessons)
        .values({
          lessonId: lesson.id,
          aiMentorInstructions: buildJsonbField("en", aiMentorLesson.aiMentorInstructions),
          name: buildJsonbField("en", aiMentorLesson.name),
          type: aiMentorLesson.type,
          voiceMode: aiMentorLesson.voiceMode,
          ttsPreset: aiMentorLesson.ttsPreset,
          customTtsReference: aiMentorLesson.customTtsReference,
        })
        .returning();

      await db.insert(aiJudgeConfigurations).values({
        aiMentorLessonId: createdAiMentorLesson.id,
        taskGoal: buildJsonbField("en", aiMentorLesson.taskGoal),
        passingThresholdPercent: 0,
      });

      return {
        ...createdAiMentorLesson,
        aiMentorInstructions: aiMentorLesson.aiMentorInstructions,
        taskGoal: aiMentorLesson.taskGoal,
        name: aiMentorLesson.name,
      };
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lessonId: faker.string.uuid(),
      aiMentorInstructions: faker.commerce.productDescription(),
      taskGoal: faker.commerce.productDescription(),
      type: DEFAULT_AI_MENTOR_TYPE,
      name: "AI Mentor",
      avatarReference: null,
      voiceMode: AI_MENTOR_VOICE_MODE.PRESET,
      ttsPreset: AI_MENTOR_TTS_PRESET.MALE,
      customTtsReference: null,
    };
  });
};
