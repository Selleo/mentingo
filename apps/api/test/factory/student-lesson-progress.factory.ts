import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { aiMentorStudentLessonProgress, studentLessonProgress } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type StudentLessonProgressTest = Omit<
  InferInsertModel<typeof studentLessonProgress>,
  "tenantId"
>;
export type AiMentorStudentLessonProgressTest = Omit<
  InferInsertModel<typeof aiMentorStudentLessonProgress>,
  "tenantId"
>;

export const createStudentLessonProgressFactory = (db: DatabasePg) => {
  return Factory.define<
    StudentLessonProgressTest,
    never,
    InferSelectModel<typeof studentLessonProgress>
  >(({ onCreate }) => {
    onCreate(async (progress) => {
      const [inserted] = await db.insert(studentLessonProgress).values(progress).returning();
      return inserted;
    });

    return {
      id: faker.string.uuid(),
      studentId: "",
      chapterId: "",
      lessonId: "",
      isStarted: true,
      completedAt: new Date().toISOString(),
    };
  });
};

export const createAiMentorStudentLessonProgressFactory = (db: DatabasePg) => {
  return Factory.define<
    AiMentorStudentLessonProgressTest,
    never,
    InferSelectModel<typeof aiMentorStudentLessonProgress>
  >(({ onCreate }) => {
    onCreate(async (progress) => {
      const [inserted] = await db
        .insert(aiMentorStudentLessonProgress)
        .values(progress)
        .returning();
      return inserted;
    });

    return {
      id: faker.string.uuid(),
      studentLessonProgressId: "",
      score: 0,
      minScore: 0,
      maxScore: 100,
      percentage: 0,
      passed: false,
    };
  });
};
