import { faker } from "@faker-js/faker";
import { COURSE_TYPE, SUPPORTED_LANGUAGES } from "@repo/shared";
import { getTableColumns, sql } from "drizzle-orm";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "src/courses/constants";

import { categories, courses, users } from "../../src/storage/schema";

import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type CourseTest = Omit<
  InferSelectModel<typeof courses>,
  "description" | "tenantId" | "title"
> & {
  description: string;
  title: string;
};

const ensureCategory = async (db: DatabasePg, categoryId?: UUIDType): Promise<UUIDType> => {
  if (categoryId) return categoryId;

  const [category] = await db
    .insert(categories)
    .values({
      id: faker.string.uuid(),
      title: buildJsonbField(
        SUPPORTED_LANGUAGES.EN,
        `${faker.commerce.department()}-${faker.string.nanoid(8)}`,
      ),
      baseLanguage: SUPPORTED_LANGUAGES.EN,
      availableLocales: [SUPPORTED_LANGUAGES.EN],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .returning();

  return category.id;
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

export const createCourseFactory = (db: DatabasePg) => {
  return Factory.define<CourseTest>(({ onCreate }) => {
    onCreate(async (course) => {
      const categoryId = await ensureCategory(db, course.categoryId);
      const authorId = await ensureAuthor(db, course.authorId);

      const [inserted] = await db
        .insert(courses)
        .values({
          ...course,
          title: buildJsonbField("en", course.title),
          description: buildJsonbField("en", course.description),
          categoryId,
          authorId,
        })
        .returning({
          ...getTableColumns(courses),
          title: sql<string>`courses.title->>'en'`,
          description: sql<string>`courses.description->>'en'`,
        });

      return inserted;
    });

    const randomHex = Math.floor(Math.random() * 100000000).toString(16);

    return {
      id: faker.string.uuid(),
      shortId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: faker.commerce.department() + randomHex,
      description: faker.commerce.productDescription(),
      thumbnailS3Key: faker.system.directoryPath(),
      status: "published",
      hasCertificate: false,
      priceInCents: faker.number.int({ min: 1000, max: 100000 }),
      currency: "usd",
      chapterCount: faker.number.int({ min: 1, max: 20 }),
      authorId: "", // Will be auto-created if empty
      categoryId: "", // Will be auto-created if empty
      courseType: COURSE_TYPE.DEFAULT,
      stripeProductId: null,
      stripePriceId: null,
      originType: "regular",
      sourceCourseId: null,
      sourceTenantId: null,
      baseLanguage: "en",
      availableLocales: ["en"],
      settings: {
        lessonSequenceEnabled: LESSON_SEQUENCE_ENABLED,
        quizFeedbackEnabled: QUIZ_FEEDBACK_ENABLED,
        certificateSignature: null,
        certificateFontColor: null,
        certificateValidity: null,
      },
    };
  });
};
