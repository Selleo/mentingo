import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { and, eq, sql } from "drizzle-orm/sql";

import { EnvRepository } from "src/env/repositories/env.repository";
import { EnvService } from "src/env/services/env.service";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import {
  aiMentorLessons,
  categories,
  chapters,
  courses,
  lessons,
  questionAnswerOptions,
  questions,
  tenants,
} from "src/storage/schema";
import { StripeService } from "src/stripe/stripe.service";

import type { DatabasePg, UUIDType } from "../common";
import type { NiceCourseData } from "../utils/types/test-types";

export async function createNiceCourses(
  creatorUserIds: UUIDType[],
  db: DatabasePg,
  data: NiceCourseData[],
  tenantId: UUIDType,
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
        tenantId,
      })
      .onConflictDoNothing({
        target: [categories.tenantId, categories.title],
      });

    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.title, courseData.category), eq(categories.tenantId, tenantId)));

    const createdAt = faker.date.past({ years: 1, refDate: new Date() }).toISOString();

    // --- create stripe product and price ---
    let stripeProductId = null;
    let stripePriceId = null;

    const envService = new EnvService(new EnvRepository(db), new ConfigService());

    const { enabled: isStripeConfigured } = await envService.getStripeConfigured();

    if (isStripeConfigured) {
      const stripeService = new StripeService(envService);

      const existingStripeProduct = await stripeService.searchProducts({
        query: `name:\'${courseData.title}\'`,
      });

      // if product exists, search for price
      if (existingStripeProduct.data.length > 0) {
        const price = await stripeService.searchPrices({
          query: `product:\'${existingStripeProduct.data?.[0].id}\' AND active:\'true\'`,
        });

        stripeProductId = existingStripeProduct.data?.[0]?.id;
        stripePriceId = price.data?.[0]?.id;
      } else {
        // create product and price
        const { productId, priceId } = await stripeService.createProduct({
          name: courseData.title,
          description: courseData.description,
          amountInCents: courseData.priceInCents ? courseData.priceInCents : 0,
          currency: courseData.currency ? courseData.currency : "usd",
        });

        stripeProductId = productId;
        stripePriceId = priceId;
      }
    }

    const [course] = await db
      .insert(courses)
      .values({
        id: crypto.randomUUID(),
        title: sql`json_build_object('en', ${courseData.title}::text)`,
        description: sql`json_build_object('en', ${courseData.description}::text)`,
        thumbnailS3Key: courseData.thumbnailS3Key,
        status: courseData.status,
        priceInCents: courseData.priceInCents,
        chapterCount: courseData.chapters.length,
        hasCertificate: courseData.hasCertificate,
        authorId: creatorUserId,
        categoryId: category.id,
        createdAt: createdAt,
        updatedAt: createdAt,
        stripeProductId,
        stripePriceId,
        tenantId,
      })
      .returning();

    for (const [index, chapterData] of courseData.chapters.entries()) {
      const [chapter] = await db
        .insert(chapters)
        .values({
          id: crypto.randomUUID(),
          title: sql`json_build_object('en', ${chapterData.title}::text)`,
          authorId: creatorUserId,
          courseId: course.id,
          isFreemium: chapterData.isFreemium,
          createdAt: createdAt,
          updatedAt: createdAt,
          displayOrder: index + 1,
          lessonCount: chapterData.lessons.length,
          tenantId,
        })
        .returning();

      for (const [index, lessonData] of chapterData.lessons.entries()) {
        const [lesson] = await db
          .insert(lessons)
          .values({
            id: crypto.randomUUID(),
            title: sql`json_build_object('en', ${lessonData.title}::text)`,
            description: sql`json_build_object('en', ${lessonData.description ?? ""}::text)`,
            type: lessonData.type,
            displayOrder: index + 1,
            fileS3Key: null,
            fileType: null,
            thresholdScore: lessonData.type === LESSON_TYPES.QUIZ ? 0 : null,
            chapterId: chapter.id,
            createdAt: createdAt,
            updatedAt: createdAt,
            tenantId,
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
              tenantId,
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
                title: sql`json_build_object('en', ${questionData.title}::text)`,
                description: sql`json_build_object('en', ${
                  questionData.description ?? null
                }::text)`,
                lessonId: lesson.id,
                authorId: creatorUserId,
                createdAt: createdAt,
                updatedAt: createdAt,
                displayOrder: index + 1,
                solutionExplanation: sql`json_build_object('en', ${
                  questionData.solutionExplanation ?? null
                }::text)`,
                photoS3Key: questionData.photoS3Key ?? null,
                tenantId,
              })
              .returning();

            if (questionData.options) {
              const questionAnswerOptionList = questionData.options.map(
                (questionAnswerOption, index) => ({
                  id: crypto.randomUUID(),
                  createdAt: createdAt,
                  updatedAt: createdAt,
                  questionId,
                  optionText: sql`json_build_object('en', ${questionAnswerOption.optionText}::text)`,
                  isCorrect: questionAnswerOption.isCorrect || false,
                  displayOrder: index + 1,
                  matchedWord: sql`json_build_object('en', ${
                    questionAnswerOption.matchedWord || null
                  }::text)`,
                  scaleAnswer: questionAnswerOption.scaleAnswer || null,
                  tenantId,
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

export async function ensureSeedTenant(
  db: DatabasePg,
  options?: { name?: string; host?: string; isManaging?: boolean },
) {
  const host = options?.host ?? "seed.local";
  const name = options?.name ?? "Seed Tenant";
  const isManaging = options?.isManaging ?? false;

  const [existing] = await db.select().from(tenants).where(eq(tenants.host, host));
  if (existing) return existing;

  const [createdTenant] = await db
    .insert(tenants)
    .values({
      name,
      host,
      isManaging,
    })
    .returning();

  return createdTenant;
}
