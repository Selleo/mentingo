import { Inject, Injectable } from "@nestjs/common";
import { RESOURCE_VISIBILITY } from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { dbAls } from "src/storage/db/db-als.store";
import { MissingTenantContextError } from "src/storage/db/db-errors";
import { DB } from "src/storage/db/db.providers";
import { resourceEntity, resources, searchChunks, searchDocuments } from "src/storage/schema";

import {
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";

import type { SemanticSearchSource, SemanticSearchSourceKey } from "./semantic-search-index.types";

export function semanticSearchResourceRevision() {
  return sql<string>`md5(coalesce(${resources.reference}, '') || ':' || ${resources.updatedAt}::text || ':' || ${resources.contentType})`;
}

@Injectable()
export class SemanticSearchIndexRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  private tenantId() {
    const tenantId = dbAls.getStore()?.tenantId;
    if (!tenantId) throw new MissingTenantContextError();
    return tenantId;
  }

  private identity(key: SemanticSearchSourceKey) {
    return and(
      eq(searchDocuments.tenantId, this.tenantId()),
      eq(searchDocuments.entityType, key.entityType),
      eq(searchDocuments.entityId, key.entityId),
      eq(searchDocuments.documentType, key.documentType),
      eq(searchDocuments.language, key.language),
    );
  }

  private sourceQuery() {
    const tenantId = this.tenantId();
    return this.db
      .select({
        entityType: searchDocuments.entityType,
        entityId: searchDocuments.entityId,
        documentType: searchDocuments.documentType,
        language: searchDocuments.language,
        content: searchDocuments.content,
        sourceHash: sql<string>`md5(${searchDocuments.content})`,
        sourceRevision: sql<string>`CASE WHEN ${
          resources.id
        } IS NULL THEN '' ELSE ${semanticSearchResourceRevision()} END`,
        metadata: searchDocuments.metadata,
        resourceReference: resources.reference,
        resourceContentType: resources.contentType,
      })
      .from(searchDocuments)
      .leftJoin(
        resources,
        sql`${resources.tenantId} = ${tenantId} AND ${resources.tenantId} = ${searchDocuments.tenantId} AND ${searchDocuments.metadata}->>'resourceId' = ${resources.id}::text AND ${resources.archived} = false AND ${resources.visibility} <> ${RESOURCE_VISIBILITY.HIDDEN}`,
      );
  }

  private eligibleSource() {
    return sql`${searchDocuments.tenantId} = ${this.tenantId()}
      AND ${searchDocuments.documentType} NOT LIKE 'answer_option:%'
      AND ${searchDocuments.documentType} NOT LIKE 'question_solution_explanation:%'
      AND (${searchDocuments.documentType} NOT LIKE 'resource:%' OR (
        ${resources.id} IS NOT NULL AND EXISTS (
          SELECT 1 FROM ${resourceEntity}
          WHERE ${resourceEntity.tenantId} = ${searchDocuments.tenantId}
            AND ${resourceEntity.tenantId} = ${resources.tenantId}
            AND ${resourceEntity.entityType} = ${searchDocuments.entityType}
            AND ${resourceEntity.entityId} = ${searchDocuments.entityId}
            AND ${resourceEntity.resourceId} = ${resources.id}
            AND ${resourceEntity.relationshipType} = 'attachment'
        )
      ))`;
  }

  async findSource(key: SemanticSearchSourceKey): Promise<SemanticSearchSource | undefined> {
    const [source] = await this.sourceQuery()
      .where(and(this.identity(key), this.eligibleSource()))
      .limit(1);
    return source;
  }

  async findPending(limit: number, offset = 0): Promise<SemanticSearchSource[]> {
    return this.sourceQuery()
      .where(
        and(
          this.eligibleSource(),
          sql`NOT EXISTS (
      SELECT 1 FROM ${searchChunks}
      WHERE ${searchChunks.tenantId} = ${searchDocuments.tenantId}
        AND ${searchChunks.entityType} = ${searchDocuments.entityType}
        AND ${searchChunks.entityId} = ${searchDocuments.entityId}
        AND ${searchChunks.documentType} = ${searchDocuments.documentType}
        AND ${searchChunks.language} = ${searchDocuments.language}
        AND ${searchChunks.sourceHash} = md5(${searchDocuments.content})
        AND ${searchChunks.sourceRevision} = CASE WHEN ${
          resources.id
        } IS NULL THEN '' ELSE ${semanticSearchResourceRevision()} END
        AND ${searchChunks.embeddingModel} = ${SEMANTIC_SEARCH_MODEL}
        AND ${searchChunks.indexVersion} = ${SEMANTIC_SEARCH_INDEX_VERSION}
    )`,
        ),
      )
      .orderBy(
        searchDocuments.updatedAt,
        searchDocuments.entityId,
        searchDocuments.documentType,
        searchDocuments.language,
      )
      .limit(limit)
      .offset(offset);
  }

  async deleteSource(key: SemanticSearchSourceKey) {
    const tenantId = this.tenantId();
    await this.db
      .delete(searchChunks)
      .where(
        and(
          eq(searchChunks.tenantId, tenantId),
          eq(searchChunks.entityType, key.entityType),
          eq(searchChunks.entityId, key.entityId),
          eq(searchChunks.documentType, key.documentType),
          eq(searchChunks.language, key.language),
        ),
      );
  }

  async cleanupDeleted() {
    const tenantId = this.tenantId();
    await this.db.execute(sql`DELETE FROM ${searchChunks} WHERE ${
      searchChunks.tenantId
    } = ${tenantId} AND NOT EXISTS (
      SELECT 1 FROM ${searchDocuments}
      LEFT JOIN ${resources} ON ${resources.tenantId} = ${searchDocuments.tenantId} AND ${
        resources.tenantId
      } = ${tenantId} AND ${searchDocuments.metadata}->>'resourceId' = ${resources.id}::text
        AND ${resources.archived} = false AND ${resources.visibility} <> ${
          RESOURCE_VISIBILITY.HIDDEN
        }
      WHERE ${searchDocuments.tenantId} = ${searchChunks.tenantId}
        AND ${searchDocuments.entityType} = ${searchChunks.entityType}
        AND ${searchDocuments.entityId} = ${searchChunks.entityId}
        AND ${searchDocuments.documentType} = ${searchChunks.documentType}
        AND ${searchDocuments.language} = ${searchChunks.language}
        AND ${this.eligibleSource()}
    )`);
  }

  async replace(
    source: SemanticSearchSource,
    chunks: string[],
    embeddings: number[][],
  ): Promise<boolean> {
    const tenantId = this.tenantId();
    // Lock the committed source row while validating and replacing its entire revision.
    return this.db.transaction(async (trx) => {
      const [current] = await trx
        .select({ hash: sql<string>`md5(${searchDocuments.content})` })
        .from(searchDocuments)
        .where(this.identity(source))
        .for("update")
        .limit(1);
      if (!current || current.hash !== source.sourceHash) return false;
      if (source.resourceReference) {
        const [resource] = await trx
          .select({ revision: semanticSearchResourceRevision() })
          .from(resources)
          .innerJoin(
            resourceEntity,
            and(
              eq(resourceEntity.tenantId, tenantId),
              eq(resourceEntity.resourceId, resources.id),
              eq(resourceEntity.entityType, source.entityType),
              eq(resourceEntity.entityId, source.entityId),
              eq(resourceEntity.relationshipType, "attachment"),
            ),
          )
          .where(
            sql`${resources.tenantId} = ${tenantId} AND ${resources.id}::text = ${String(
              source.metadata.resourceId,
            )} AND ${resources.archived} = false AND ${resources.visibility} <> ${
              RESOURCE_VISIBILITY.HIDDEN
            }`,
          )
          .for("update")
          .limit(1);
        if (!resource || resource.revision !== source.sourceRevision) return false;
      }
      await trx
        .delete(searchChunks)
        .where(
          and(
            eq(searchChunks.tenantId, tenantId),
            eq(searchChunks.entityType, source.entityType),
            eq(searchChunks.entityId, source.entityId),
            eq(searchChunks.documentType, source.documentType),
            eq(searchChunks.language, source.language),
          ),
        );
      await trx.insert(searchChunks).values(
        chunks.map((content, chunkIndex) => ({
          tenantId,
          entityType: source.entityType,
          entityId: source.entityId,
          documentType: source.documentType,
          language: source.language,
          chunkIndex,
          content,
          searchVector: sql`to_tsvector('simple', ${content})`,
          embedding: embeddings[chunkIndex],
          sourceHash: source.sourceHash,
          sourceRevision: source.sourceRevision,
          embeddingModel: SEMANTIC_SEARCH_MODEL,
          indexVersion: SEMANTIC_SEARCH_INDEX_VERSION,
          metadata: source.metadata,
        })),
      );
      return true;
    });
  }
}
