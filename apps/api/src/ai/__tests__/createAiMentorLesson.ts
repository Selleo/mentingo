import { faker } from "@faker-js/faker";
import { AI_MENTOR_TYPE } from "@repo/shared";
import { Factory } from "fishery";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import { aiMentorLessons, lessons } from "src/storage/schema";

import { createChapterFactory } from "../../../test/factory/chapter.factory";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type AiMentorLessonTest = InferSelectModel<typeof aiMentorLessons>;

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
          title: faker.commerce.productName(),
          isExternal: true,
        })
        .returning();

      const [createdAiMentorLesson] = await db
        .insert(aiMentorLessons)
        .values({
          lessonId: lesson.id,
          aiMentorInstructions: aiMentorLesson.aiMentorInstructions,
          completionConditions: aiMentorLesson.completionConditions,
          type: aiMentorLesson.type,
        })
        .returning();

      return createdAiMentorLesson;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lessonId: faker.string.uuid(),
      aiMentorInstructions: faker.commerce.productDescription(),
      completionConditions: faker.commerce.productDescription(),
      type: AI_MENTOR_TYPE.MENTOR,
    };
  });
};
