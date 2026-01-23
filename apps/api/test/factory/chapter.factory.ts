import { faker } from "@faker-js/faker";
import { getTableColumns, sql } from "drizzle-orm";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { chapters, users } from "src/storage/schema";

import { ensureTenant } from "../helpers/tenant-helpers";

import { createCourseFactory } from "./course.factory";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ChapterTest = InferSelectModel<typeof chapters>;

const ensureCourse = async (
  db: DatabasePg,
  tenantId: UUIDType,
  courseId?: UUIDType,
): Promise<UUIDType> => {
  if (courseId) return courseId;

  const courseFactory = createCourseFactory(db);
  const course = await courseFactory.create({ tenantId });
  return course.id;
};

const ensureAuthor = async (
  db: DatabasePg,
  tenantId: UUIDType,
  authorId?: UUIDType,
): Promise<UUIDType> => {
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
      tenantId,
    })
    .returning();

  return author.id;
};

export const createChapterFactory = (db: DatabasePg) => {
  return Factory.define<ChapterTest>(({ onCreate }) => {
    onCreate(async (chapter) => {
      const tenantId = await ensureTenant(db, chapter.tenantId);
      const courseId = await ensureCourse(db, tenantId, chapter.courseId);
      const authorId = await ensureAuthor(db, tenantId, chapter.authorId);

      const [inserted] = await db
        .insert(chapters)
        .values({
          ...chapter,
          title: buildJsonbField("en", chapter.title as string),
          courseId,
          authorId,
          tenantId,
        })
        .returning({
          ...getTableColumns(chapters),
          title: sql`chapters.title->>'en'`,
        });

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
      tenantId: undefined as unknown as UUIDType,
    };
  });
};
