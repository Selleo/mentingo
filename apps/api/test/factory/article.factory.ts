import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { buildJsonbField, buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { articles, articleSections, users } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ArticleSectionTest = InferSelectModel<typeof articleSections>;
export type ArticleTest = InferSelectModel<typeof articles>;

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

const ensureSection = async (db: DatabasePg, sectionId?: UUIDType) => {
  if (sectionId) return sectionId;

  const sectionFactory = createArticleSectionFactory(db);
  const section = await sectionFactory.create();
  return section.id;
};

export const createArticleSectionFactory = (db: DatabasePg) => {
  return Factory.define<ArticleSectionTest>(({ onCreate }) => {
    onCreate(async (section) => {
      const language = (section.baseLanguage as SupportedLanguages) ?? "en";

      const [inserted] = await db
        .insert(articleSections)
        .values({
          ...section,
          title: buildJsonbField(language, section.title as string),
          baseLanguage: section.baseLanguage ?? language,
          availableLocales: section.availableLocales ?? [language],
        })
        .returning();

      return inserted;
    });

    return {
      id: faker.string.uuid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      title: faker.commerce.department(),
      baseLanguage: "en",
      availableLocales: ["en"],
    } as ArticleSectionTest;
  });
};

export const createArticleFactory = (db: DatabasePg) => {
  return Factory.define<ArticleTest>(({ onCreate }) => {
    onCreate(async (article) => {
      const language = (article.baseLanguage as SupportedLanguages) ?? "en";
      const sectionId = await ensureSection(db, article.articleSectionId as UUIDType);
      const authorId = await ensureAuthor(db, article.authorId as UUIDType);

      const status = article.status ?? "published";
      const publishedAt =
        status === "published" ? (article.publishedAt ?? new Date().toISOString()) : null;

      const [inserted] = await db
        .insert(articles)
        .values({
          ...article,
          title: buildJsonbField(language, article.title as string),
          summary: buildJsonbField(language, article.summary as string),
          content: buildJsonbField(language, article.content as string),
          baseLanguage: article.baseLanguage ?? language,
          availableLocales: article.availableLocales ?? [language],
          articleSectionId: sectionId,
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
      content: "<p>Article content</p>",
      status: "published",
      isPublic: true,
      archived: false,
      baseLanguage: "en",
      availableLocales: ["en"],
      publishedAt: new Date().toISOString(),
      articleSectionId: "",
      authorId: "",
      updatedBy: null,
    } as ArticleTest;
  });
};

export const createArticleWithLocales = async (
  db: DatabasePg,
  options: {
    articleSectionId: UUIDType;
    authorId: UUIDType;
    locales: SupportedLanguages[];
    baseLanguage: SupportedLanguages;
    titles: Record<SupportedLanguages, string>;
    summaries?: Record<SupportedLanguages, string>;
    contents?: Record<SupportedLanguages, string>;
    status?: "draft" | "published";
    isPublic?: boolean;
    publishedAt?: string | null;
  },
) => {
  const status = options.status ?? "published";
  const publishedAt =
    status === "published" ? (options.publishedAt ?? new Date().toISOString()) : null;

  const [article] = await db
    .insert(articles)
    .values({
      title: buildJsonbFieldWithMultipleEntries(options.titles),
      summary: buildJsonbFieldWithMultipleEntries(options.summaries ?? options.titles),
      content: buildJsonbFieldWithMultipleEntries(options.contents ?? options.titles),
      status,
      isPublic: options.isPublic ?? true,
      baseLanguage: options.baseLanguage,
      availableLocales: options.locales,
      publishedAt,
      articleSectionId: options.articleSectionId,
      authorId: options.authorId,
    })
    .returning();

  return article as ArticleTest;
};
