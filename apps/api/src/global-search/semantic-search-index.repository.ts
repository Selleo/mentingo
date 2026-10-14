import { Inject, Injectable } from "@nestjs/common";
import { RESOURCE_VISIBILITY } from "@repo/shared";
import { and, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { RICH_TEXT_RELATIONSHIP_TYPES } from "src/resource-library/resource-library.constants";
import { dbAls } from "src/storage/db/db-als.store";
import { MissingTenantContextError } from "src/storage/db/db-errors";
import { DB } from "src/storage/db/db.providers";
import { resourceEntity, resources, searchChunks, searchDocuments } from "src/storage/schema";

import {
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_MODEL,
} from "./semantic-search-index.constants";
import { semanticSearchResourceSources } from "./semantic-search-resource.utils";

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
            AND ${resourceEntity.relationshipType} IN (${sql.join(
              RICH_TEXT_RELATIONSHIP_TYPES.map((type) => sql`${type}`),
              sql`, `,
            )})
        )
      ))`;
  }

  async synchronizeResourceDocuments() {
    const tenantId = this.tenantId();
    const sources = semanticSearchResourceSources(tenantId);
    await this.db.transaction(async (trx) => {
      await trx.execute(sql`${sources}
        DELETE FROM search_documents s
        WHERE s.tenant_id = ${tenantId} AND s.metadata->>'semanticResource' = 'true'
          AND NOT EXISTS (SELECT 1 FROM resource_sources r
            WHERE r.tenant_id = s.tenant_id AND r.entity_type = s.entity_type
              AND r.entity_id = s.entity_id AND r.document_type = s.document_type
              AND r.language = s.language)`);
      await trx.execute(sql`${sources}
        INSERT INTO search_documents (tenant_id, entity_type, entity_id, document_type,
          language, content, search_vector, metadata)
        SELECT tenant_id, entity_type, entity_id, document_type, language, content,
          setweight(to_tsvector('simple', content), 'D'), metadata FROM resource_sources
        ON CONFLICT (tenant_id, entity_type, entity_id, document_type, language)
        DO UPDATE SET content = EXCLUDED.content, search_vector = EXCLUDED.search_vector,
          metadata = EXCLUDED.metadata, updated_at = CURRENT_TIMESTAMP
        WHERE search_documents.content IS DISTINCT FROM EXCLUDED.content
          OR search_documents.metadata IS DISTINCT FROM EXCLUDED.metadata`);
    });
  }

  async findSource(key: SemanticSearchSourceKey): Promise<SemanticSearchSource | undefined> {
    const [source] = await this.sourceQuery()
      .where(and(this.identity(key), this.eligibleSource()))
      .limit(1);
    return source;
  }

  private pendingSourcesQuery() {
    return this.sourceQuery().where(
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
    );
  }

  async findPending(limit: number, offset = 0): Promise<SemanticSearchSource[]> {
    return this.pendingSourcesQuery()
      .orderBy(
        searchDocuments.updatedAt,
        searchDocuments.entityId,
        searchDocuments.documentType,
        searchDocuments.language,
      )
      .limit(limit)
      .offset(offset);
  }

  async previewPendingCount(limit: number, offset = 0): Promise<number> {
    const sources = semanticSearchResourceSources(this.tenantId());
    const pending = this.pendingSourcesQuery();
    const result = await this.db.execute(sql`${sources}, pending_keys AS (
      SELECT p.entity_type, p.entity_id, p.document_type, p.language FROM (${pending}) p
      UNION
      SELECT r.entity_type, r.entity_id, r.document_type, r.language FROM resource_sources r
      JOIN resources file ON file.id::text = r.metadata->>'resourceId'
        AND file.tenant_id = r.tenant_id
      WHERE NOT EXISTS (SELECT 1 FROM search_chunks c
        WHERE c.tenant_id = r.tenant_id AND c.entity_type = r.entity_type
          AND c.entity_id = r.entity_id AND c.document_type = r.document_type
          AND c.language = r.language AND c.source_hash = md5(r.content)
          AND c.source_revision = md5(coalesce(file.reference, '') || ':' || file.updated_at::text || ':' || file.content_type)
          AND c.embedding_model = ${SEMANTIC_SEARCH_MODEL}
          AND c.index_version = ${SEMANTIC_SEARCH_INDEX_VERSION})
    )
    SELECT count(*)::integer AS pending FROM (
      SELECT 1 FROM pending_keys ORDER BY entity_type, entity_id, document_type, language
      LIMIT ${limit} OFFSET ${offset}
    ) batch`);
    return Number(result[0]?.pending ?? 0);
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
              sql`${resourceEntity.relationshipType} IN (${sql.join(
                RICH_TEXT_RELATIONSHIP_TYPES.map((type) => sql`${type}`),
                sql`, `,
              )})`,
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
          metadata: sql`${JSON.stringify(source.metadata)}::text::jsonb`,
        })),
      );
      return true;
    });
  }
}
