import { faker } from "@faker-js/faker";
import { eq, sql } from "drizzle-orm/sql";

import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
} from "src/storage/schema";

import type { DatabasePg, UUIDType } from "../common";
import type { NiceCourseData } from "../utils/types/test-types";
import type { LessonTypes } from "src/lesson/lesson.type";

export async function createNiceCourses(
  creatorUserIds: UUIDType[],
  db: DatabasePg,
  data: NiceCourseData[],
) {
  const createdCourses = [];

  for (let i = 0; i < data.length; i++) {
    const courseData = data[i];
    const creatorIndex = i % creatorUserIds.length;
    const creatorUserId = creatorUserIds[creatorIndex];

    await db
      .insert(categories)
      .values({
        id: crypto.randomUUID(),
        title: courseData.category,
        archived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoNothing();

    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.title, courseData.category));

    const createdAt = faker.date.past({ years: 1, refDate: new Date() }).toISOString();

    const [course] = await db
      .insert(courses)
      .values({
        id: crypto.randomUUID(),
        title: courseData.title,
        description: courseData.description,
        thumbnailS3Key: courseData.thumbnailS3Key,
        status: courseData.status,
        priceInCents: courseData.priceInCents,
        chapterCount: courseData.chapters.length,
        authorId: creatorUserId,
        categoryId: category.id,
        createdAt: createdAt,
        updatedAt: createdAt,
      })
      .returning();

    for (const [index, chapterData] of courseData.chapters.entries()) {
      const [chapter] = await db
        .insert(chapters)
        .values({
          id: crypto.randomUUID(),
          title: chapterData.title,
          authorId: creatorUserId,
          courseId: course.id,
          isFreemium: chapterData.isFreemium,
          createdAt: createdAt,
          updatedAt: createdAt,
          displayOrder: index + 1,
          lessonCount: chapterData.lessons.length,
        })
        .returning();

      for (const [index, lessonData] of chapterData.lessons.entries()) {
        const [lesson] = await db
          .insert(lessons)
          .values({
            id: crypto.randomUUID(),
            title: lessonData.title,
            description: lessonData.description,
            type: lessonData.type,
            displayOrder: index + 1,
            fileS3Key: getFileUrl(lessonData.type),
            fileType:
              lessonData.type === LESSON_TYPES.PRESENTATION
                ? "pptx"
                : lessonData.type === LESSON_TYPES.VIDEO
                  ? "mp4"
                  : null,
            thresholdScore: lessonData.type === LESSON_TYPES.QUIZ ? 0 : null,
            chapterId: chapter.id,
            createdAt: createdAt,
            updatedAt: createdAt,
          })
          .returning();
        if (
          lessonData.type === LESSON_TYPES.AI_MENTOR &&
          lessonData.aiMentorInstructions &&
          lessonData.completionConditions
        ) {
          await db
            .insert(aiMentorLessons)
            .values({
              lessonId: lesson.id,
              aiMentorInstructions: lessonData.aiMentorInstructions,
              completionConditions: lessonData.completionConditions,
            })
            .returning();
        }
        if (lessonData.type === LESSON_TYPES.QUIZ && lessonData.questions) {
          for (const [index, questionData] of lessonData.questions.entries()) {
            const questionId = crypto.randomUUID();

            await db
              .insert(questions)
              .values({
                id: questionId,
                type: questionData.type,
                title: questionData.title,
                description: questionData.description ?? null,
                lessonId: lesson.id,
                authorId: creatorUserId,
                createdAt: createdAt,
                updatedAt: createdAt,
                displayOrder: index + 1,
                solutionExplanation: questionData.solutionExplanation ?? null,
                photoS3Key: questionData.photoS3Key ?? null,
              })
              .returning();

            if (questionData.options) {
              const questionAnswerOptionList = questionData.options.map(
                (questionAnswerOption, index) => ({
                  id: crypto.randomUUID(),
                  createdAt: createdAt,
                  updatedAt: createdAt,
                  questionId,
                  optionText: questionAnswerOption.optionText,
                  isCorrect: questionAnswerOption.isCorrect || false,
                  displayOrder: index + 1,
                  matchedWord: questionAnswerOption.matchedWord || null,
                  scaleAnswer: questionAnswerOption.scaleAnswer || null,
                }),
              );

              await db.insert(questionAnswerOptions).values(questionAnswerOptionList);
            }
          }
        }
      }
    }
    createdCourses.push(course);
  }

  return createdCourses;
}

export async function seedTruncateAllTables(db: DatabasePg): Promise<void> {
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public'
      `);

    const tables = (result as unknown as Record<string, unknown>[]).map(
      (row) => row.tablename as string,
    );

    await tx.execute(sql`SET CONSTRAINTS ALL DEFERRED`);

    for (const table of tables) {
      console.log(`Truncating table ${table}`);
      await tx.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} CASCADE`);
    }

    await tx.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
  });
}

const external_video_urls = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WhatCarCanYouGetForAGrand.mp4",
];

const external_presentation_urls = [
  "https://res.cloudinary.com/dinpapxzv/raw/upload/v1727104719/presentation_gp0o3d.pptx",
];

function getFileUrl(lessonType: LessonTypes) {
  if (lessonType === LESSON_TYPES.VIDEO) {
    return faker.helpers.arrayElement(external_video_urls);
  } else if (lessonType === LESSON_TYPES.PRESENTATION) {
    return faker.helpers.arrayElement(external_presentation_urls);
  }
  return null;
}
