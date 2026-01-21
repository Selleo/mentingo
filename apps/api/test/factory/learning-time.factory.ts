import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import {
  lessonLearningTime,
  users,
  courses,
  chapters,
  lessons,
  categories,
} from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type LearningTimeTest = InferSelectModel<typeof lessonLearningTime>;

const ensureUser = async (db: DatabasePg, userId?: UUIDType | null): Promise<UUIDType> => {
  if (userId) return userId;

  const [user] = await db
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

  return user.id;
};

const ensureCategory = async (db: DatabasePg): Promise<UUIDType> => {
  const [category] = await db
    .insert(categories)
    .values({
      id: faker.string.uuid(),
      title: `${faker.commerce.department()}-${faker.string.nanoid(8)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return category.id;
};

const ensureCourse = async (db: DatabasePg, courseId?: UUIDType | null): Promise<UUIDType> => {
  if (courseId) return courseId;

  const authorId = await ensureUser(db);
  const categoryId = await ensureCategory(db);

  const [course] = await db
    .insert(courses)
    .values({
      id: faker.string.uuid(),
      title: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      thumbnailS3Key: faker.system.directoryPath(),
      status: "published",
      priceInCents: faker.number.int({ min: 1000, max: 100000 }),
      currency: "usd",
      chapterCount: 1,
      isScorm: false,
      authorId,
      categoryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return course.id;
};

const ensureChapter = async (db: DatabasePg, courseId: UUIDType): Promise<UUIDType> => {
  const authorId = await ensureUser(db);

  const [chapter] = await db
    .insert(chapters)
    .values({
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      courseId,
      authorId,
      isFreemium: false,
      displayOrder: 1,
      lessonCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return chapter.id;
};

const ensureLesson = async (
  db: DatabasePg,
  lessonId?: UUIDType | null,
  courseId?: UUIDType | null,
): Promise<{ lessonId: UUIDType; courseId: UUIDType }> => {
  const actualCourseId = courseId ?? (await ensureCourse(db));

  if (lessonId) {
    return { lessonId, courseId: actualCourseId };
  }

  const chapterId = await ensureChapter(db, actualCourseId);

  const [lesson] = await db
    .insert(lessons)
    .values({
      id: faker.string.uuid(),
      chapterId,
      type: "text",
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      displayOrder: 1,
      fileS3Key: faker.system.directoryPath(),
      fileType: "html",
      isExternal: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return { lessonId: lesson.id, courseId: actualCourseId };
};

export const createLearningTimeFactory = (db: DatabasePg) => {
  return Factory.define<LearningTimeTest>(({ onCreate }) => {
    onCreate(async (learningTime) => {
      const userId = await ensureUser(db, learningTime.userId);
      const { lessonId, courseId } = await ensureLesson(
        db,
        learningTime.lessonId,
        learningTime.courseId,
      );

      const [inserted] = await db
        .insert(lessonLearningTime)
        .values({
          ...learningTime,
          userId,
          lessonId,
          courseId,
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: null as unknown as string, // Will be replaced by ensureUser
      lessonId: null as unknown as string, // Will be replaced by ensureLesson
      courseId: null as unknown as string, // Will be replaced by ensureLesson
      totalSeconds: faker.number.int({ min: 60, max: 3600 }),
    };
  });
};

export const createLearningTimeTestSetup = async (db: DatabasePg) => {
  const userId = await ensureUser(db);
  const courseId = await ensureCourse(db);
  const { lessonId } = await ensureLesson(db, undefined, courseId);

  return { userId, courseId, lessonId };
};
