import { faker } from "@faker-js/faker";
import { Factory } from "fishery";

import { buildJsonbField, buildJsonbFieldWithMultipleEntries } from "src/common/helpers/sqlHelpers";
import { articles, articleSections, users } from "src/storage/schema";

import { ensureTenant } from "../helpers/tenant-helpers";

import type { SupportedLanguages } from "@repo/shared";
import type { InferSelectModel } from "drizzle-orm";
import type { DatabasePg, UUIDType } from "src/common";

export type ArticleSectionTest = InferSelectModel<typeof articleSections>;
export type ArticleTest = InferSelectModel<typeof articles>;

const ensureAuthor = async (db: DatabasePg, tenantId: UUIDType, authorId?: UUIDType) => {
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

const ensureSection = async (db: DatabasePg, tenantId: UUIDType, sectionId?: UUIDType) => {
  if (sectionId) return sectionId;

  const sectionFactory = createArticleSectionFactory(db);
  const section = await sectionFactory.create({ tenantId });
  return section.id;
};

export const createArticleSectionFactory = (db: DatabasePg) => {
  return Factory.define<ArticleSectionTest>(({ onCreate }) => {
    onCreate(async (section) => {
      const language = (section.baseLanguage as SupportedLanguages) ?? "en";
      const tenantId = await ensureTenant(db, section.tenantId);

      const [inserted] = await db
        .insert(articleSections)
        .values({
          ...section,
          title: buildJsonbField(language, section.title as string),
          baseLanguage: section.baseLanguage ?? language,
          availableLocales: section.availableLocales ?? [language],
          tenantId,
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
      tenantId: undefined as unknown as UUIDType,
    } as ArticleSectionTest;
  });
};

export const createArticleFactory = (db: DatabasePg) => {
  return Factory.define<ArticleTest>(({ onCreate }) => {
    onCreate(async (article) => {
      const language = (article.baseLanguage as SupportedLanguages) ?? "en";
      const tenantId = await ensureTenant(db, article.tenantId as UUIDType | undefined);
      const sectionId = await ensureSection(db, tenantId, article.articleSectionId as UUIDType);
      const authorId = await ensureAuthor(db, tenantId, article.authorId as UUIDType);

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
          tenantId,
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
      tenantId: undefined as unknown as UUIDType,
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
    tenantId?: UUIDType;
  },
) => {
  const status = options.status ?? "published";
  const publishedAt =
    status === "published" ? (options.publishedAt ?? new Date().toISOString()) : null;
  const tenantId = await ensureTenant(db, options.tenantId);

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
      tenantId,
    })
    .returning();

  return article as ArticleTest;
};
