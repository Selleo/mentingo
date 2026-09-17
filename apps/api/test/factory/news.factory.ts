import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { buildJsonbField } from "src/common/helpers/sqlHelpers";
import { news, users } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type NewsTest = InferSelectModel<typeof news>;

const ensureAuthor = async (db: DatabasePg, authorId?: UUIDType) => {
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

export const createNewsFactory = (db: DatabasePg) => {
  return Factory.define<NewsTest>(({ onCreate }) => {
    onCreate(async (newsItem) => {
      const language = (newsItem.baseLanguage as SupportedLanguages) ?? "en";
      const authorId = await ensureAuthor(db, newsItem.authorId as UUIDType);
      const status = newsItem.status ?? "published";
      const publishedAt =
        status === "published" ? (newsItem.publishedAt ?? new Date().toISOString()) : null;

      const [inserted] = await db
        .insert(news)
        .values({
          ...newsItem,
          title: buildJsonbField(language, newsItem.title as string),
          summary: buildJsonbField(language, newsItem.summary as string),
          content: buildJsonbField(language, newsItem.content as string),
          baseLanguage: language,
          availableLocales: newsItem.availableLocales ?? [language],
          authorId,
          status,
          publishedAt,
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: faker.lorem.words(3),
      summary: faker.lorem.sentence(),
      content: "<p>News content</p>",
      status: "published",
      isPublic: true,
      archived: false,
      baseLanguage: "en",
      availableLocales: ["en"],
      publishedAt: new Date().toISOString(),
      authorId: "",
    } as NewsTest;
  });
};
