import { Inject, Injectable } from "@nestjs/common";
import { ARTICLE_STATUS, ENTITY_TYPES } from "@repo/shared";
import { and, asc, desc, eq, getTableColumns, gt, isNull, lt, ne, not, sql } from "drizzle-orm";

import { baseArticleTitle } from "src/articles/constants";
import { DatabasePg } from "src/common";
import { deleteJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { normalizeSearchTerm } from "src/common/utils/normalizeSearchTerm";
import { LocalizationService } from "src/localization/localization.service";
import { articleSections, articles, resourceEntity, resources, users } from "src/storage/schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import type { SupportedLanguages } from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { ArticleItem } from "src/articles/schemas/articleToc.schema";
import type { UUIDType } from "src/common";
import type { CurrentUser } from "src/common/types/current-user.type";

@Injectable()
export class ArticlesRepository {
  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async createArticleSection(language: SupportedLanguages, titleJsonb: unknown) {
    return this.db
      .insert(articleSections)
      .values({
        title: titleJsonb,
        baseLanguage: language,
        availableLocales: [language],
      })
      .returning({
        id: articleSections.id,
        title: this.localizationService.getFieldByLanguage(articleSections.title, language),
      });
  }

  async updateArticleSectionTitle(
    sectionId: UUIDType,
    language: SupportedLanguages,
    title: string,
  ) {
    return this.db
      .update(articleSections)
      .set({ title: setJsonbField(articleSections.title, language, title) })
      .where(eq(articleSections.id, sectionId))
      .returning({
        id: articleSections.id,
        title: this.localizationService.getFieldByLanguage(articleSections.title, language),
      });
  }

  async addLanguageToSection(
    sectionId: UUIDType,
    language: SupportedLanguages,
    availableLocales: SupportedLanguages[],
    title: string,
  ) {
    return this.db
      .update(articleSections)
      .set({
        availableLocales: [...availableLocales, language],
        title: setJsonbField(articleSections.title, language, title),
      })
      .where(eq(articleSections.id, sectionId))
      .returning({
        id: articleSections.id,
        title: this.localizationService.getFieldByLanguage(articleSections.title, language),
      });
  }

  async removeLanguageFromSection(
    sectionId: UUIDType,
    language: SupportedLanguages,
    updatedLocales: SupportedLanguages[],
  ) {
    return this.db
      .update(articleSections)
      .set({
        availableLocales: updatedLocales,
        title: deleteJsonbField(articleSections.title, language),
      })
      .where(eq(articleSections.id, sectionId))
      .returning({
        id: articleSections.id,
        availableLocales: articleSections.availableLocales,
      });
  }

  async countArticlesInSection(sectionId: UUIDType): Promise<number> {
    const [{ assignedArticlesCount }] = await this.db
      .select({ assignedArticlesCount: sql<number>`COUNT(*)::int` })
      .from(articles)
      .where(and(eq(articles.articleSectionId, sectionId), eq(articles.isPublic, true)));

    return assignedArticlesCount ?? 0;
  }

  async deleteSection(sectionId: UUIDType) {
    return this.db
      .delete(articleSections)
      .where(eq(articleSections.id, sectionId))
      .returning({ id: articleSections.id });
  }

  async createArticle(
    language: SupportedLanguages,
    titleJsonb: unknown,
    authorId: UUIDType,
    sectionId: UUIDType,
  ) {
    return this.db
      .insert(articles)
      .values({
        title: titleJsonb,
        baseLanguage: language,
        availableLocales: [language],
        authorId,
        articleSectionId: sectionId,
        status: ARTICLE_STATUS.PUBLISHED,
        publishedAt: sql`NOW()`,
      })
      .returning({
        id: articles.id,
        title: this.localizationService.getFieldByLanguage(articles.title, language),
      });
  }

  async updateArticle(
    articleId: UUIDType,
    language: SupportedLanguages,
    updateData: Record<string, unknown>,
    updatedBy: UUIDType | null,
  ) {
    return this.db
      .update(articles)
      .set({ ...updateData, updatedBy })
      .where(eq(articles.id, articleId))
      .returning({
        id: articles.id,
        title: this.localizationService.getFieldByLanguage(articles.title, language),
      });
  }

  async getArticles(
    requestedLanguage: SupportedLanguages,
    conditions: SQL<unknown>[],
    searchQuery?: string,
  ) {
    const searchConditions = [...conditions];

    const isSearching = searchQuery && searchQuery.trim().length >= 3;
    const searchTerm = isSearching ? searchQuery.trim() : null;
    const articlesTsVector = sql`(
      setweight(jsonb_to_tsvector('english', ${articles.title}, '["string"]'), 'A') ||
      setweight(jsonb_to_tsvector('english', COALESCE(${articles.summary}, '{}'::jsonb), '["string"]'), 'B') ||
      setweight(jsonb_to_tsvector('english', COALESCE(${articles.content}, '{}'::jsonb), '["string"]'), 'C')
    )`;

    const tsQuery = sql`to_tsquery('english', ${normalizeSearchTerm(searchTerm ?? "")})`;

    if (isSearching && searchTerm) {
      searchConditions.push(sql`${articlesTsVector} @@ ${tsQuery}`);
    }

    return this.db
      .select({
        ...getTableColumns(articles),
        title: this.localizationService.getFieldByLanguage(articles.title, requestedLanguage),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(articles)
      .innerJoin(articleSections, eq(articleSections.id, articles.articleSectionId))
      .leftJoin(users, eq(users.id, articles.authorId))
      .where(and(...searchConditions))
      .orderBy(
        isSearching && searchTerm
          ? sql`ts_rank(${articlesTsVector}, ${tsQuery}) DESC`
          : desc(articles.publishedAt),
      );
  }

  async getDraftArticles(requestedLanguage: SupportedLanguages) {
    return this.db
      .select({
        ...getTableColumns(articles),
        title: this.localizationService.getFieldByLanguage(articles.title, requestedLanguage),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
      })
      .from(articles)
      .leftJoin(users, eq(users.id, articles.authorId))
      .where(and(ne(articles.archived, true), isNull(articles.publishedAt)))
      .orderBy(desc(articles.createdAt));
  }

  async deleteArticleLanguage(
    articleId: UUIDType,
    language: SupportedLanguages,
    updatedLocales: SupportedLanguages[],
  ) {
    return this.db
      .update(articles)
      .set({
        availableLocales: updatedLocales,
        title: deleteJsonbField(articles.title, language),
        content: deleteJsonbField(articles.content, language),
        summary: deleteJsonbField(articles.summary, language),
      })
      .where(eq(articles.id, articleId))
      .returning({
        id: articles.id,
        availableLocales: articles.availableLocales,
      });
  }

  async archiveArticle(articleId: UUIDType, updatedBy: UUIDType | null) {
    return this.db
      .update(articles)
      .set({
        archived: true,
        isPublic: false,
        updatedBy,
      })
      .where(eq(articles.id, articleId))
      .returning({ id: articles.id });
  }

  async getArticleWithAccess(
    articleId: UUIDType,
    requestedLanguage: SupportedLanguages,
    accessConditions: SQL<unknown>[],
  ) {
    return this.db
      .select({
        ...getTableColumns(articles),
        authorName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
        title: this.localizationService.getFieldByLanguage(articles.title, requestedLanguage),
        content: this.localizationService.getFieldByLanguage(articles.content, requestedLanguage),
        summary: this.localizationService.getFieldByLanguage(articles.summary, requestedLanguage),
        baseLanguage: sql<SupportedLanguages>`${articles.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articles.availableLocales}`,
      })
      .from(articles)
      .innerJoin(articleSections, eq(articleSections.id, articles.articleSectionId))
      .leftJoin(users, eq(users.id, articles.authorId))
      .where(and(eq(articles.id, articleId), ...accessConditions));
  }

  async getAdjacentArticleIds(
    referenceDate: string,
    conditions: SQL<unknown>[],
    sortColumn: AnyPgColumn,
  ): Promise<{ nextArticle: UUIDType | null; previousArticle: UUIDType | null }> {
    const [nextArticle] = await this.db
      .select({ id: articles.id })
      .from(articles)
      .innerJoin(articleSections, eq(articleSections.id, articles.articleSectionId))
      .where(and(...conditions, gt(sortColumn, referenceDate)))
      .orderBy(asc(sortColumn))
      .limit(1);

    const [previousArticle] = await this.db
      .select({ id: articles.id })
      .from(articles)
      .innerJoin(articleSections, eq(articleSections.id, articles.articleSectionId))
      .where(and(...conditions, lt(sortColumn, referenceDate)))
      .orderBy(desc(sortColumn))
      .limit(1);

    return { nextArticle: nextArticle?.id ?? null, previousArticle: previousArticle?.id ?? null };
  }

  async createArticleLanguage(
    articleId: UUIDType,
    language: SupportedLanguages,
    availableLocales: SupportedLanguages[],
  ) {
    return this.db
      .update(articles)
      .set({
        availableLocales: [...availableLocales, language],
        title: setJsonbField(articles.title, language, baseArticleTitle[language]),
      })
      .where(eq(articles.id, articleId))
      .returning({
        id: articles.id,
        title: this.localizationService.getFieldByLanguage(articles.title, language),
      });
  }

  async getArticleById(articleId: UUIDType) {
    return this.db
      .select({
        ...getTableColumns(articles),
        baseLanguage: sql<SupportedLanguages>`${articles.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articles.availableLocales}`,
      })
      .from(articles)
      .where(eq(articles.id, articleId));
  }

  async getSectionById(sectionId: UUIDType) {
    return this.db
      .select({
        ...getTableColumns(articleSections),
        baseLanguage: sql<SupportedLanguages>`${articleSections.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articleSections.availableLocales}`,
      })
      .from(articleSections)
      .where(eq(articleSections.id, sectionId));
  }

  async getResource(resourceId: UUIDType) {
    const [resource] = await this.db
      .select({
        ...getTableColumns(resources),
        entityId: resourceEntity.entityId,
        entityType: resourceEntity.entityType,
      })
      .from(resources)
      .innerJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
      .where(
        and(
          eq(resources.id, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.ARTICLES),
          eq(resources.archived, false),
        ),
      );

    return resource;
  }

  async getArticleSectionDetails(sectionId: UUIDType, requestedLanguage: SupportedLanguages) {
    const sectionTitle = this.localizationService.getFieldByLanguage(
      articleSections.title,
      requestedLanguage,
    );

    return this.db
      .select({
        id: articleSections.id,
        title: sectionTitle,
        baseLanguage: sql<SupportedLanguages>`${articleSections.baseLanguage}`,
        availableLocales: sql<SupportedLanguages[]>`${articleSections.availableLocales}`,
        assignedArticlesCount: sql<number>`COUNT(${articles.id})::int`,
      })
      .from(articleSections)
      .leftJoin(
        articles,
        and(eq(articles.articleSectionId, articleSections.id), eq(articles.isPublic, true)),
      )
      .where(and(eq(articleSections.id, sectionId)))
      .groupBy(
        articleSections.id,
        sectionTitle,
        articleSections.baseLanguage,
        articleSections.availableLocales,
      );
  }

  async getArticleSections(
    requestedLanguage: SupportedLanguages,
    conditions: SQL<unknown>[],
    currentUser?: CurrentUser,
  ) {
    const sectionTitle =
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR
        ? this.localizationService.getFieldByLanguage(articleSections.title, requestedLanguage)
        : this.localizationService.getLocalizedSqlField(
            articleSections.title,
            requestedLanguage,
            articleSections,
          );

    const articleTitle = this.localizationService.getFieldByLanguage(
      articles.title,
      requestedLanguage,
    );

    return this.db
      .select({
        id: articleSections.id,
        title: sectionTitle,
        articles: sql<ArticleItem[]>`COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', ${articles.id},
            'title', ${articleTitle}
          ) ORDER BY ${articles.createdAt}
        ) FILTER (WHERE ${articles.id} IS NOT NULL),
        '[]'::jsonb
      )`,
      })
      .from(articleSections)
      .leftJoin(articles, and(eq(articles.articleSectionId, articleSections.id), ...conditions))
      .groupBy(articleSections.id, sectionTitle)
      .orderBy(asc(sectionTitle));
  }

  async getArticleAuthorId(articleId: UUIDType) {
    return this.db
      .select({ authorId: articles.authorId })
      .from(articles)
      .where(eq(articles.id, articleId));
  }

  getVisibleArticleConditions(
    language: SupportedLanguages,
    currentUser?: CurrentUser,
    options?: { isDraftMode?: boolean; excludedId?: UUIDType },
  ): SQL<unknown>[] {
    const isAdminLike =
      currentUser?.role === USER_ROLES.ADMIN || currentUser?.role === USER_ROLES.CONTENT_CREATOR;

    const conditions = [
      ne(articles.archived, true),
      ...(options?.isDraftMode
        ? [isNull(articles.publishedAt)]
        : [not(isNull(articles.publishedAt))]),
      ...(!currentUser ? [eq(articles.isPublic, true)] : []),
      ...(isAdminLike ? [] : [sql`${language} = ANY(${articles.availableLocales})`]),
      ...(isAdminLike ? [] : [sql`${language} = ANY(${articleSections.availableLocales})`]),
    ];

    if (options?.excludedId) conditions.push(ne(articles.id, options.excludedId));

    return conditions;
  }
}
