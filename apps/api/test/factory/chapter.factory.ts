import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { chapters, users } from "src/storage/schema";

import { createCourseFactory } from "./course.factory";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ChapterTest = InferSelectModel<typeof chapters>;

const ensureCourse = async (db: DatabasePg, courseId?: UUIDType): Promise<UUIDType> => {
  if (courseId) return courseId;

  const courseFactory = createCourseFactory(db);
  const course = await courseFactory.create();
  return course.id;
};

const ensureAuthor = async (db: DatabasePg, authorId?: UUIDType): Promise<UUIDType> => {
  if (authorId) return authorId;

  const [author] = await db
    .insert(users)
    .values({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return author.id;
};

export const createChapterFactory = (db: DatabasePg) => {
  return Factory.define<ChapterTest>(({ onCreate }) => {
    onCreate(async (chapter) => {
      const courseId = await ensureCourse(db, chapter.courseId);
      const authorId = await ensureAuthor(db, chapter.authorId);

      const [inserted] = await db
        .insert(chapters)
        .values({
          ...chapter,
          courseId,
          authorId,
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: faker.commerce.productName(),
      courseId: "", // Will be auto-created if empty
      authorId: "", // Will be auto-created if empty
      isFreemium: false,
      displayOrder: faker.number.int({ min: 1, max: 100 }),
      lessonCount: faker.number.int({ min: 0, max: 20 }),
    };
  });
};
