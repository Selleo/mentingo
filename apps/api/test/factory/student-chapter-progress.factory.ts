import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { studentChapterProgress } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type StudentChapterProgressTest = Omit<
  InferInsertModel<typeof studentChapterProgress>,
  "tenantId"
>;

export const createStudentChapterProgressFactory = (db: DatabasePg) =>
  Factory.define<
    StudentChapterProgressTest,
    never,
    InferSelectModel<typeof studentChapterProgress>
  >(({ onCreate }) => {
    onCreate(async (progress) => {
      const [inserted] = await db.insert(studentChapterProgress).values(progress).returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      studentId: "",
      courseId: "",
      chapterId: "",
      completedLessonCount: 0,
    };
  });
