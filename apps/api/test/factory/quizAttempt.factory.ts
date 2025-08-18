import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { USER_ROLES } from "src/user/schemas/userRoles";

import {
  quizAttempts,
  users,
  courses,
  chapters,
  lessons,
  categories,
} from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

type QuizAttemptTest = InferSelectModel<typeof quizAttempts>;

const ensureUser = async (
  db: DatabasePg,
  isContentCreator: boolean = false,
  userId?: UUIDType,
): Promise<UUIDType> => {
  if (userId) return userId;

  const [user] = await db
    .insert(users)
    .values({
      id: faker.string.uuid(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      avatarReference: faker.image.avatar(),
      role: isContentCreator ? USER_ROLES.CONTENT_CREATOR : USER_ROLES.STUDENT,
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
      title: faker.commerce.department(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return category.id;
};

const ensureCourse = async (db: DatabasePg, courseId?: UUIDType): Promise<UUIDType> => {
  if (courseId) return courseId;

  const authorId = await ensureUser(db, true);
  const categoryId = await ensureCategory(db);

  const [course] = await db
    .insert(courses)
    .values({
      id: faker.string.uuid(),
      title: faker.commerce.productName(),
      description: faker.commerce.productDescription(),
      thumbnailS3Key: faker.system.directoryPath(),
      isPublished: true,
      priceInCents: faker.number.int({ min: 1000, max: 100000 }),
      currency: "usd",
      chapterCount: faker.number.int({ min: 1, max: 20 }),
      isScorm: false,
      authorId,
      categoryId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return course.id;
};

const ensureChapter = async (
  db: DatabasePg,
  chapterId?: UUIDType,
  courseId?: UUIDType,
): Promise<{ chapterId: UUIDType; courseId: UUIDType }> => {
  let actualCourseId = courseId;

  if (!actualCourseId) {
    actualCourseId = await ensureCourse(db);
  }

  if (chapterId) {
    return { chapterId, courseId: actualCourseId };
  }

  const authorId = await ensureUser(db, true);

  const [chapter] = await db
    .insert(chapters)
    .values({
      id: faker.string.uuid(),
      title: faker.lorem.sentence(),
      courseId: actualCourseId,
      authorId,
      isFreemium: faker.datatype.boolean(),
      displayOrder: faker.number.int({ min: 1, max: 10 }),
      lessonCount: faker.number.int({ min: 1, max: 10 }),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return { chapterId: chapter.id, courseId: actualCourseId };
};

const ensureLesson = async (
  db: DatabasePg,
  lessonId?: UUIDType,
  chapterId?: UUIDType,
  courseId?: UUIDType,
): Promise<{ lessonId: UUIDType; courseId: UUIDType }> => {
  const { chapterId: actualChapterId, courseId: actualCourseId } = await ensureChapter(
    db,
    chapterId,
    courseId,
  );

  if (lessonId) {
    return { lessonId, courseId: actualCourseId };
  }

  const lessonType = faker.helpers.arrayElement(["video", "text", "quiz", "assignment"]);

  const [lesson] = await db
    .insert(lessons)
    .values({
      id: faker.string.uuid(),
      chapterId: actualChapterId,
      type: lessonType,
      title: faker.lorem.sentence(),
      description: faker.lorem.paragraph(),
      thresholdScore: lessonType === "quiz" ? faker.number.int({ min: 0, max: 100 }) : null,
      displayOrder: faker.number.int({ min: 1, max: 10 }),
      fileS3Key: faker.system.directoryPath(),
      fileType: faker.helpers.arrayElement(["mp4", "pdf", "html", "docx"]),
      isExternal: faker.datatype.boolean(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return { lessonId: lesson.id, courseId: actualCourseId };
};

export const createQuizAttemptFactory = (db: DatabasePg) => {
  return Factory.define<QuizAttemptTest>(({ onCreate }) => {
    onCreate(async (attempt) => {
      const userId = await ensureUser(db, false, attempt.userId);
      const { lessonId, courseId } = await ensureLesson(
        db,
        attempt.lessonId,
        undefined,
        attempt.courseId,
      );

      const [inserted] = await db
        .insert(quizAttempts)
        .values({
          ...attempt,
          userId,
          courseId,
          lessonId,
        })
        .returning();

      return inserted;
    });

    const correctAnswers = faker.number.int({ min: 0, max: 10 });
    const wrongAnswers = faker.number.int({ min: 0, max: 10 });
    const totalQuestions = correctAnswers + wrongAnswers;
    const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "", // Will be auto-created if empty
      courseId: "", // Will be auto-created if empty
      lessonId: "", // Will be auto-created if empty
      correctAnswers,
      wrongAnswers,
      score,
    };
  });
};
