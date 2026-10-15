import { faker } from "@faker-js/faker";
import { LESSON_TYPES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Factory } from "fishery";

import { buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { lessons } from "src/storage/schema";

import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { DatabasePg } from "src/common";

export type LessonTest = Omit<InferInsertModel<typeof lessons>, "tenantId">;

export const createLessonFactory = (db: DatabasePg) => {
  return Factory.define<LessonTest, never, InferSelectModel<typeof lessons>>(({ onCreate }) => {
    onCreate(async (lesson) => {
      const [inserted] = await db
        .insert(lessons)
        .values({
          ...lesson,
          title: buildJsonbFieldWithMultipleEntries(lesson.title ?? {}),
          description: lesson.description
            ? buildJsonbFieldWithMultipleEntries(lesson.description)
            : null,
        })
        .returning();
      return inserted;
    });

    return {
      id: faker.string.uuid(),
      chapterId: "",
      type: LESSON_TYPES.CONTENT,
      title: { [SUPPORTED_LANGUAGES.EN]: faker.commerce.productName() },
      description: { [SUPPORTED_LANGUAGES.EN]: `<p>${faker.lorem.sentence()}</p>` },
      displayOrder: 1,
      fileS3Key: null,
      fileType: null,
    };
  });
};
