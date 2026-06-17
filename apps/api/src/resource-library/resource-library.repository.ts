import { Inject, Injectable } from "@nestjs/common";
import { ENTITY_TYPES, RESOURCE_LIBRARY_ASSET_TYPE, type SupportedLanguages } from "@repo/shared";
import {
  and,
  countDistinct,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  not,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { match } from "ts-pattern";

import { DatabasePg, type UUIDType } from "src/common";
import { setJsonbField } from "src/common/helpers/sqlHelpers";
import { addPagination } from "src/common/pagination";
import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { articles, lessons, news, resourceEntity, resources } from "src/storage/schema";

import {
  KNOWN_RICH_TEXT_ASSET_MIME_TYPES,
  RICH_TEXT_ASSET_MIME_TYPES_BY_TYPE,
  RICH_TEXT_ENTITY_TYPES,
  RICH_TEXT_RELATIONSHIP_TYPES,
} from "./resource-library.constants";
import { getAssetDisplayFileName, getMetadataTextValue } from "./resource-library.utils";

import type {
  ResourceLibraryAssetType,
  RichTextAssetEntityType,
} from "./schemas/resource-library.schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

@Injectable()
export class ResourceLibraryRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async getAssets(params: {
    page: number;
    perPage: number;
    search?: string;
    type?: ResourceLibraryAssetType;
    language?: SupportedLanguages;
  }) {
    const conditions = this.getAssetConditions(params.search, params.type);

    return this.db.transaction(async (trx) => {
      const assetQuery = trx
        .select(this.getAssetSelectFields(params.language))
        .from(resources)
        .leftJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
        .where(and(...conditions))
        .groupBy(resources.id)
        .orderBy(desc(resources.createdAt))
        .$dynamic();

      const rows = await addPagination(assetQuery, params.page, params.perPage);

      const [{ totalItems }] = await trx
        .select({ totalItems: countDistinct(resources.id) })
        .from(resources)
        .leftJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
        .where(and(...conditions));

      return { rows, totalItems };
    });
  }

  async getAssetRelationUsages(resourceId: UUIDType, language?: SupportedLanguages) {
    const lessonUsages = await this.db
      .select({
        id: resourceEntity.id,
        entityId: resourceEntity.entityId,
        entityType: sql<RichTextAssetEntityType>`${resourceEntity.entityType}`,
        title: this.getLocalizedTitleSql(lessons.title, language),
        relationshipType: resourceEntity.relationshipType,
        createdAt: resourceEntity.createdAt,
      })
      .from(resourceEntity)
      .innerJoin(lessons, eq(lessons.id, resourceEntity.entityId))
      .where(
        and(
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.LESSON),
        ),
      );

    const articleUsages = await this.db
      .select({
        id: resourceEntity.id,
        entityId: resourceEntity.entityId,
        entityType: sql<RichTextAssetEntityType>`${resourceEntity.entityType}`,
        title: this.getLocalizedTitleSql(articles.title, language),
        relationshipType: resourceEntity.relationshipType,
        createdAt: resourceEntity.createdAt,
      })
      .from(resourceEntity)
      .innerJoin(articles, eq(articles.id, resourceEntity.entityId))
      .where(
        and(
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.ARTICLES),
        ),
      );

    const newsUsages = await this.db
      .select({
        id: resourceEntity.id,
        entityId: resourceEntity.entityId,
        entityType: sql<RichTextAssetEntityType>`${resourceEntity.entityType}`,
        title: this.getLocalizedTitleSql(news.title, language),
        relationshipType: resourceEntity.relationshipType,
        createdAt: resourceEntity.createdAt,
      })
      .from(resourceEntity)
      .innerJoin(news, eq(news.id, resourceEntity.entityId))
      .where(
        and(
          eq(resourceEntity.resourceId, resourceId),
          eq(resourceEntity.entityType, ENTITY_TYPES.NEWS),
        ),
      );

    return [...lessonUsages, ...articleUsages, ...newsUsages];
  }

  async getAssetContentReferenceUsages(resourceId: UUIDType, language?: SupportedLanguages) {
    const pattern = this.getResourceIdSearchPattern(resourceId);

    const lessonUsages = await this.db
      .select({
        id: lessons.id,
        entityId: lessons.id,
        entityType: sql<RichTextAssetEntityType>`${ENTITY_TYPES.LESSON}`,
        title: this.getLocalizedTitleSql(lessons.title, language),
        relationshipType: sql<string>`${RESOURCE_RELATIONSHIP_TYPES.CONTENT}`,
        createdAt: lessons.createdAt,
      })
      .from(lessons)
      .where(
        this.localizationService.getLocalizedFieldSearchCondition(
          lessons.description,
          pattern,
          language,
        ),
      );

    const articleUsages = await this.db
      .select({
        id: articles.id,
        entityId: articles.id,
        entityType: sql<RichTextAssetEntityType>`${ENTITY_TYPES.ARTICLES}`,
        title: this.getLocalizedTitleSql(articles.title, language),
        relationshipType: sql<string>`${RESOURCE_RELATIONSHIP_TYPES.CONTENT}`,
        createdAt: articles.createdAt,
      })
      .from(articles)
      .where(
        this.localizationService.getLocalizedFieldSearchCondition(
          articles.content,
          pattern,
          language,
        ),
      );

    const newsUsages = await this.db
      .select({
        id: news.id,
        entityId: news.id,
        entityType: sql<RichTextAssetEntityType>`${ENTITY_TYPES.NEWS}`,
        title: this.getLocalizedTitleSql(news.title, language),
        relationshipType: sql<string>`${RESOURCE_RELATIONSHIP_TYPES.CONTENT}`,
        createdAt: news.createdAt,
      })
      .from(news)
      .where(
        this.localizationService.getLocalizedFieldSearchCondition(news.content, pattern, language),
      );

    return [...lessonUsages, ...articleUsages, ...newsUsages];
  }

  async assetExists(resourceId: UUIDType) {
    const conditions = this.getAssetConditions();

    const [asset] = await this.db
      .select({ id: resources.id })
      .from(resources)
      .leftJoin(resourceEntity, eq(resourceEntity.resourceId, resources.id))
      .where(and(eq(resources.id, resourceId), ...conditions))
      .limit(1);

    return Boolean(asset);
  }

  async entityExists(entityType: RichTextAssetEntityType, entityId: UUIDType) {
    switch (entityType) {
      case ENTITY_TYPES.LESSON: {
        const [entity] = await this.db
          .select({ id: lessons.id })
          .from(lessons)
          .where(eq(lessons.id, entityId))
          .limit(1);

        return Boolean(entity);
      }
      case ENTITY_TYPES.ARTICLES: {
        const [entity] = await this.db
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.id, entityId))
          .limit(1);

        return Boolean(entity);
      }
      case ENTITY_TYPES.NEWS: {
        const [entity] = await this.db
          .select({ id: news.id })
          .from(news)
          .where(eq(news.id, entityId))
          .limit(1);

        return Boolean(entity);
      }
      default:
        return false;
    }
  }

  async createAssetRelation(params: {
    resourceId: UUIDType;
    entityId: UUIDType;
    entityType: RichTextAssetEntityType;
    relationshipType?: string;
  }) {
    await this.db
      .insert(resourceEntity)
      .values({
        resourceId: params.resourceId,
        entityId: params.entityId,
        entityType: params.entityType,
        relationshipType: params.relationshipType ?? RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      })
      .onConflictDoNothing();
  }

  async getLessonContent(lessonId: UUIDType) {
    const [lesson] = await this.db
      .select({ description: lessons.description })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    return lesson?.description;
  }

  async getArticleContent(articleId: UUIDType) {
    const [article] = await this.db
      .select({ content: articles.content })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);

    return article?.content;
  }

  async getNewsContent(newsId: UUIDType) {
    const [newsItem] = await this.db
      .select({ content: news.content })
      .from(news)
      .where(eq(news.id, newsId))
      .limit(1);

    return newsItem?.content;
  }

  async deleteAssetRelation(params: {
    resourceId: UUIDType;
    entityId: UUIDType;
    entityType: RichTextAssetEntityType;
    relationshipType?: string;
  }) {
    const deletedRelations = await this.db
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.resourceId, params.resourceId),
          eq(resourceEntity.entityId, params.entityId),
          eq(resourceEntity.entityType, params.entityType),
          eq(
            resourceEntity.relationshipType,
            params.relationshipType ?? RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
          ),
        ),
      )
      .returning({ id: resourceEntity.id });

    return deletedRelations.length;
  }

  async deleteEntityAttachmentRelations(
    params: {
      entityId: UUIDType;
      entityType: RichTextAssetEntityType;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .delete(resourceEntity)
      .where(
        and(
          eq(resourceEntity.entityId, params.entityId),
          eq(resourceEntity.entityType, params.entityType),
          eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
        ),
      );
  }

  async getExistingAssetIds(resourceIds: UUIDType[], dbInstance: DatabasePg = this.db) {
    if (!resourceIds.length) return [];

    return dbInstance
      .select({ id: resources.id })
      .from(resources)
      .where(and(inArray(resources.id, resourceIds), eq(resources.archived, false)));
  }

  async createAssetRelations(
    params: {
      resourceId: UUIDType;
      entityId: UUIDType;
      entityType: RichTextAssetEntityType;
      relationshipType: string;
    }[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!params.length) return;

    await dbInstance.insert(resourceEntity).values(params).onConflictDoNothing();
  }

  async countAssetRelations(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    const [{ deletedUsages }] = await dbInstance
      .select({ deletedUsages: countDistinct(resourceEntity.id) })
      .from(resourceEntity)
      .where(eq(resourceEntity.resourceId, resourceId));

    return deletedUsages;
  }

  async deleteAssetRelations(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    await dbInstance.delete(resourceEntity).where(eq(resourceEntity.resourceId, resourceId));
  }

  async archiveAsset(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    await dbInstance.update(resources).set({ archived: true }).where(eq(resources.id, resourceId));
  }

  async getLessonRowsReferencingAsset(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    const pattern = this.getResourceIdSearchPattern(resourceId);

    return dbInstance
      .select({
        id: lessons.id,
        description: lessons.description,
      })
      .from(lessons)
      .where(
        this.localizationService.getLocalizedFieldSearchCondition(lessons.description, pattern),
      );
  }

  async getArticleRowsReferencingAsset(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    const pattern = this.getResourceIdSearchPattern(resourceId);

    return dbInstance
      .select({ id: articles.id, content: articles.content })
      .from(articles)
      .where(this.localizationService.getLocalizedFieldSearchCondition(articles.content, pattern));
  }

  async getNewsRowsReferencingAsset(resourceId: UUIDType, dbInstance: DatabasePg = this.db) {
    const pattern = this.getResourceIdSearchPattern(resourceId);

    return dbInstance
      .select({ id: news.id, content: news.content })
      .from(news)
      .where(this.localizationService.getLocalizedFieldSearchCondition(news.content, pattern));
  }

  async updateLessonDescription(
    params: {
      lessonId: UUIDType;
      language: string;
      content: string;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(lessons)
      .set({
        description: setJsonbField(
          lessons.description,
          params.language,
          params.content,
          true,
          true,
        ),
      })
      .where(eq(lessons.id, params.lessonId));
  }

  async updateArticleContent(
    params: {
      articleId: UUIDType;
      language: string;
      content: string;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(articles)
      .set({
        content: setJsonbField(articles.content, params.language, params.content, true, true),
      })
      .where(eq(articles.id, params.articleId));
  }

  async updateNewsContent(
    params: {
      newsId: UUIDType;
      language: string;
      content: string;
    },
    dbInstance: DatabasePg = this.db,
  ) {
    await dbInstance
      .update(news)
      .set({ content: setJsonbField(news.content, params.language, params.content, true, true) })
      .where(eq(news.id, params.newsId));
  }

  async replaceEntityAttachmentRelations(
    params: {
      entityId: UUIDType;
      entityType: RichTextAssetEntityType;
      resourceIds: UUIDType[];
    },
    dbInstance: DatabasePg = this.db,
  ) {
    const relationScope = and(
      eq(resourceEntity.entityId, params.entityId),
      eq(resourceEntity.entityType, params.entityType),
      eq(resourceEntity.relationshipType, RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT),
    );

    if (!params.resourceIds.length) {
      await dbInstance.delete(resourceEntity).where(relationScope);
      return;
    }

    await dbInstance
      .delete(resourceEntity)
      .where(and(relationScope, not(inArray(resourceEntity.resourceId, params.resourceIds))));

    const existingResources = await this.getExistingAssetIds(params.resourceIds, dbInstance);

    await this.createAssetRelations(
      existingResources.map((resource) => ({
        resourceId: resource.id,
        entityId: params.entityId,
        entityType: params.entityType,
        relationshipType: RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT,
      })),
      dbInstance,
    );
  }

  private getAssetConditions(search?: string, type?: ResourceLibraryAssetType): SQL[] {
    const richTextUsageOrUnusedAssetCondition = or(
      and(
        inArray(resourceEntity.entityType, [...RICH_TEXT_ENTITY_TYPES]),
        inArray(resourceEntity.relationshipType, [...RICH_TEXT_RELATIONSHIP_TYPES]),
      ),
      isNull(resourceEntity.id),
    );

    const conditions: SQL[] = [eq(resources.archived, false)];

    if (richTextUsageOrUnusedAssetCondition) conditions.push(richTextUsageOrUnusedAssetCondition);

    const normalizedSearch = search?.trim();

    if (normalizedSearch) {
      const pattern = `%${normalizedSearch}%`;

      const searchCondition = or(
        ilike(resources.reference, pattern),
        sql`${resources.metadata}->>'originalFilename' ilike ${pattern}`,
        sql`${resources.title}::text ilike ${pattern}`,
      );

      if (searchCondition) conditions.push(searchCondition);
    }

    const typeCondition = this.getAssetTypeCondition(type);

    if (typeCondition) conditions.push(typeCondition);

    return conditions;
  }

  private getAssetTypeCondition(type?: ResourceLibraryAssetType): SQL | null {
    return match(type)
      .with("image", "video", "pdf", "presentation", "document", (assetType) =>
        inArray(resources.contentType, [...RICH_TEXT_ASSET_MIME_TYPES_BY_TYPE[assetType]]),
      )
      .with("other", () =>
        not(inArray(resources.contentType, [...KNOWN_RICH_TEXT_ASSET_MIME_TYPES])),
      )
      .otherwise(() => null);
  }

  private getResourceIdSearchPattern(resourceId: UUIDType) {
    return `%${resourceId}%`;
  }

  private getAssetSelectFields(language?: SupportedLanguages) {
    const originalFilename = getMetadataTextValue(resources.metadata, "originalFilename");

    const resolvedDisplayFileName = getAssetDisplayFileName({
      localizedTitle: this.getLocalizedTitleSql(resources.title, language),
      originalFilename,
      reference: resources.reference,
    });

    return {
      id: resources.id,
      fileName: resolvedDisplayFileName,
      title: resolvedDisplayFileName,
      contentType: resources.contentType,
      type: this.getAssetTypeSql(),
      size: sql<number | null>`NULLIF(${resources.metadata}->>'size', '')::int`,
      originalFilename,
      reference: resources.reference,
      uploadedBy: resources.uploadedBy,
      createdAt: sql<string>`${resources.createdAt}::text`,
      usageCount: sql<number>`count(distinct ${resourceEntity.id})::int`,
    };
  }

  private getLocalizedTitleSql(field: AnyPgColumn, language?: SupportedLanguages) {
    if (language)
      return sql<string>`COALESCE(${this.localizationService.getFieldByLanguage(
        field,
        language,
      )}, 'Untitled')`;

    return sql<string>`COALESCE(${this.localizationService.getFirstValue(field)}, 'Untitled')`;
  }

  private getAssetTypeSql() {
    const whenClauses = Object.entries(RICH_TEXT_ASSET_MIME_TYPES_BY_TYPE).map(
      ([type, mimeTypes]) => sql`WHEN ${resources.contentType} IN ${mimeTypes} THEN ${type}`,
    );

    return sql<ResourceLibraryAssetType>`CASE ${sql.join(whenClauses, sql` `)} ELSE ${RESOURCE_LIBRARY_ASSET_TYPE.OTHER} END`;
  }
}
