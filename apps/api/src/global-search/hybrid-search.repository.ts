import { Inject, Injectable } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  COURSE_STATUSES,
  LEARNING_PATH_STATUSES,
  PERMISSIONS,
  RESOURCE_VISIBILITY,
} from "@repo/shared";
import { sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { hasAnyPermission, hasPermission } from "src/common/permissions/permission.utils";
import { normalizeSearchTerm } from "src/common/utils/normalizeSearchTerm";
import { DB } from "src/storage/db/db.providers";

import { SEARCH_DOCUMENT_TYPES, SEARCH_ENTITY_TYPES } from "./global-search.constants";
import {
  SEMANTIC_SEARCH_MODEL,
  SEMANTIC_SEARCH_INDEX_VERSION,
  SEMANTIC_SEARCH_ENTITY_LIMIT,
  SEMANTIC_SEARCH_INITIAL_CANDIDATES,
  SEMANTIC_SEARCH_MAX_CANDIDATE_BATCHES,
  SEMANTIC_SEARCH_HNSW_EF_SEARCH,
  SEMANTIC_SEARCH_MAX_DISTANCE,
} from "./semantic-search-index.constants";

import type { MatchRow, SearchEntityType, SemanticCandidateMatchRow } from "./global-search.types";
import type { SQL } from "drizzle-orm";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class HybridSearchRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findKeywordMatches(
    entityType: SearchEntityType,
    query: string,
    actor: CurrentUserType,
    metadataOnly = false,
  ): Promise<MatchRow[]> {
    const eligibility = sql`(${this.eligibility(entityType, actor)}) AND ${this.sourceAccess(actor)} AND ${metadataOnly ? sql`s.document_type IN (${SEARCH_DOCUMENT_TYPES.TITLE}, ${SEARCH_DOCUMENT_TYPES.DESCRIPTION})` : sql`true`}`;
    const result = await this.db.execute(sql`
      WITH q AS (SELECT to_tsquery('simple', ${normalizeSearchTerm(query)}) AS value), hits AS (
        SELECT s.entity_id, s.language, ts_rank(s.search_vector, q.value) AS rank,
          NULL::text AS passage, NULL::text AS filename
        FROM search_documents s CROSS JOIN q
        WHERE s.tenant_id = ${actor.tenantId} AND s.entity_type = ${entityType}
          AND ${eligibility} AND s.search_vector @@ q.value
        UNION ALL
        SELECT s.entity_id, s.language, ts_rank(c.search_vector, q.value) AS rank,
          ts_headline('simple', c.content, q.value,
            'StartSel=,StopSel=,MaxWords=45,MinWords=15,MaxFragments=1') AS passage,
          c.metadata->>'fileName' AS filename
        FROM search_chunks c JOIN search_documents s ON ${this.currentSource(actor)}
        CROSS JOIN q
        WHERE s.tenant_id = ${actor.tenantId} AND s.entity_type = ${entityType}
          AND ${eligibility} AND c.search_vector @@ q.value
      )
      SELECT entity_id AS "entityId", array_agg(DISTINCT language) AS languages,
        max(rank) AS rank,
        (array_agg(passage ORDER BY (passage IS NOT NULL) DESC, rank DESC, language, passage))[1] AS "matchedPassage",
        (array_agg(filename ORDER BY (passage IS NOT NULL) DESC, rank DESC, language, passage))[1] AS "matchedAttachmentFileName"
      FROM hits GROUP BY entity_id ORDER BY max(rank) DESC, entity_id LIMIT 50
    `);
    return result as unknown as MatchRow[];
  }

  async findSemanticMatches(
    entityType: SearchEntityType,
    embedding: number[],
    actor: CurrentUserType,
    metadataOnly = false,
  ): Promise<MatchRow[]> {
    return this.db.transaction(async (trx) => {
      // Transaction-local settings use the same connection as every candidate query.
      await trx.execute(sql`SELECT
        set_config('hnsw.ef_search', ${String(SEMANTIC_SEARCH_HNSW_EF_SEARCH)}, true),
        set_config('hnsw.iterative_scan', 'strict_order', true)`);
      const matches = new Map<string, MatchRow>();
      let limit = SEMANTIC_SEARCH_INITIAL_CANDIDATES;
      for (let batch = 0; batch < SEMANTIC_SEARCH_MAX_CANDIDATE_BATCHES; batch++) {
        const result = await trx.execute(
          this.buildSemanticCandidateQuery(
            entityType,
            embedding,
            actor,
            limit,
            [...matches.keys()],
            metadataOnly,
          ),
        );
        const rows = result as unknown as SemanticCandidateMatchRow[];
        const candidateCount = Number(rows[0]?.candidateCount ?? 0);
        let recovered = 0;
        for (const row of rows) {
          if (!row.entityId) continue;
          matches.set(row.entityId, {
            entityId: row.entityId,
            languages: row.languages,
            rank: row.rank,
            matchedPassage: row.matchedPassage,
            matchedAttachmentFileName: row.matchedAttachmentFileName,
          });
          recovered++;
        }
        // Exhausted candidates or the relevance floor: farther chunks cannot improve results.
        if (
          matches.size >= SEMANTIC_SEARCH_ENTITY_LIMIT ||
          recovered === 0 ||
          candidateCount < limit
        )
          break;
        // Exclude previously found entities so a long attachment cannot consume every batch.
        limit *= 2;
      }
      return [...matches.values()]
        .sort((a, b) => b.rank - a.rank || a.entityId.localeCompare(b.entityId))
        .slice(0, SEMANTIC_SEARCH_ENTITY_LIMIT);
    });
  }

  /** Keep distance ordering and LIMIT at the chunk level so PostgreSQL can use HNSW. */
  buildSemanticCandidateQuery(
    entityType: SearchEntityType,
    embedding: number[],
    actor: CurrentUserType,
    limit: number,
    excludedEntityIds: string[] = [],
    metadataOnly = false,
  ): SQL {
    const vector = `[${embedding.join(",")}]`;
    const unseen = excludedEntityIds.length
      ? sql`c.entity_id NOT IN (${sql.join(
          excludedEntityIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`
      : sql`true`;
    return sql`
      WITH nearest AS MATERIALIZED (
        SELECT c.entity_id, c.language, c.embedding <=> ${vector}::vector AS distance,
          left(c.content, 320) AS passage, c.metadata->>'fileName' AS filename
        FROM search_chunks c
        WHERE c.tenant_id = ${actor.tenantId} AND c.entity_type = ${entityType}
          AND c.embedding_model = ${SEMANTIC_SEARCH_MODEL}
          AND c.index_version = ${SEMANTIC_SEARCH_INDEX_VERSION}
          AND ${unseen}
          AND ${metadataOnly ? sql`c.document_type IN (${SEARCH_DOCUMENT_TYPES.TITLE}, ${SEARCH_DOCUMENT_TYPES.DESCRIPTION})` : sql`true`}
          -- OFFSET 0 keeps the source/access check correlated, preserving the HNSW scan.
          AND EXISTS (SELECT 1 FROM search_documents s
            WHERE ${this.currentSource(actor)} AND ${this.eligibility(entityType, actor)}
            OFFSET 0)
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT ${limit}
      ), grouped AS (
      SELECT entity_id AS "entityId", array_agg(DISTINCT language) AS languages,
        1 - min(distance) AS rank,
        (array_agg(passage ORDER BY distance, language, passage))[1] AS "matchedPassage",
        (array_agg(filename ORDER BY distance, language, passage))[1] AS "matchedAttachmentFileName",
        (SELECT count(*)::integer FROM nearest) AS "candidateCount"
      FROM nearest WHERE distance <= ${SEMANTIC_SEARCH_MAX_DISTANCE}
      GROUP BY entity_id ORDER BY min(distance), entity_id LIMIT ${SEMANTIC_SEARCH_ENTITY_LIMIT}
      )
      SELECT * FROM grouped
      UNION ALL
      SELECT NULL::uuid, ARRAY[]::text[], 0::double precision, NULL::text, NULL::text,
        (SELECT count(*)::integer FROM nearest)
      WHERE NOT EXISTS (SELECT 1 FROM grouped)
    `;
  }

  async hasCurrentChunks(actor: CurrentUserType): Promise<boolean> {
    const eligibility = sql.join(
      Object.values(SEARCH_ENTITY_TYPES).map(
        (type) => sql`(s.entity_type = ${type} AND ${this.eligibility(type, actor)})`,
      ),
      sql` OR `,
    );
    const result = await this.db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM search_chunks c JOIN search_documents s ON ${this.currentSource(actor)}
        WHERE s.tenant_id = ${actor.tenantId} AND (${eligibility})
          AND c.embedding IS NOT NULL AND c.embedding_model = ${SEMANTIC_SEARCH_MODEL}
          AND c.index_version = ${SEMANTIC_SEARCH_INDEX_VERSION}
      ) AND NOT EXISTS (
        SELECT 1 FROM search_documents s
        WHERE s.tenant_id = ${actor.tenantId} AND (${eligibility})
          AND s.document_type NOT LIKE 'answer_option:%'
          AND s.document_type NOT LIKE 'question_solution_explanation:%'
          AND (s.metadata->>'resourceId' IS NULL OR EXISTS (
            SELECT 1 FROM resources r JOIN resource_entity re ON re.resource_id = r.id
            WHERE r.id::text = s.metadata->>'resourceId' AND r.archived = false
              AND r.visibility <> ${RESOURCE_VISIBILITY.HIDDEN}
              AND (r.visibility = ${RESOURCE_VISIBILITY.PUBLIC} OR r.uploaded_by_id = ${actor.userId}
                OR ${hasPermission(actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE)})
              AND re.entity_id = s.entity_id AND re.entity_type = s.entity_type
              AND re.relationship_type = 'attachment'
          ))
          AND NOT EXISTS (SELECT 1 FROM search_chunks c WHERE ${this.currentSource(actor)}
            AND c.embedding IS NOT NULL AND c.embedding_model = ${SEMANTIC_SEARCH_MODEL}
            AND c.index_version = ${SEMANTIC_SEARCH_INDEX_VERSION})
      ) AS ready
    `);
    return result[0]?.ready === true;
  }

  /** A source can disappear or change before its asynchronous indexing job completes. */
  private sourceAccess(actor: CurrentUserType): SQL {
    return sql`(s.metadata->>'resourceId' IS NULL OR EXISTS (
      SELECT 1 FROM resources r JOIN resource_entity re ON re.resource_id = r.id
      WHERE r.id::text = s.metadata->>'resourceId' AND r.archived = false
        AND r.visibility <> ${RESOURCE_VISIBILITY.HIDDEN}
        AND (r.visibility = ${RESOURCE_VISIBILITY.PUBLIC} OR r.uploaded_by_id = ${actor.userId}
          OR ${hasPermission(actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE)})
        AND r.tenant_id = s.tenant_id AND re.tenant_id = s.tenant_id
        AND re.entity_id = s.entity_id AND re.entity_type = s.entity_type
        AND re.relationship_type = 'attachment'
    ))`;
  }

  private currentSource(actor: CurrentUserType): SQL {
    return sql`
      c.tenant_id = s.tenant_id AND c.entity_type = s.entity_type
      AND c.entity_id = s.entity_id AND c.document_type = s.document_type
      AND c.language = s.language AND c.source_hash = md5(s.content)
      AND (
        (s.metadata->>'resourceId' IS NULL AND c.source_revision = '')
        OR EXISTS (
          SELECT 1 FROM resources r JOIN resource_entity re ON re.resource_id = r.id
          WHERE r.id::text = s.metadata->>'resourceId' AND r.archived = false
            AND r.visibility <> ${RESOURCE_VISIBILITY.HIDDEN}
            AND (r.visibility = ${RESOURCE_VISIBILITY.PUBLIC}
              OR r.uploaded_by_id = ${actor.userId}
              OR ${hasPermission(actor.permissions, PERMISSIONS.RESOURCE_LIBRARY_MANAGE)})
            AND r.tenant_id = s.tenant_id AND re.tenant_id = s.tenant_id
            AND re.entity_id = s.entity_id AND re.entity_type = s.entity_type
            AND re.relationship_type = 'attachment'
            AND c.source_revision = md5(COALESCE(r.reference, '') || ':' || r.updated_at::text || ':' || r.content_type)
        )
      )
    `;
  }

  /** Apply current entity access before ranking/limits, including source-language availability. */
  private eligibility(type: SearchEntityType, actor: CurrentUserType): SQL {
    const can = (permission: Parameters<typeof hasPermission>[1]) =>
      hasPermission(actor.permissions, permission);
    const any = (permissions: Parameters<typeof hasAnyPermission>[1]) =>
      hasAnyPermission(actor.permissions, permissions);
    if (type === SEARCH_ENTITY_TYPES.COURSE) {
      const scope = [sql`false`];
      if (can(PERMISSIONS.COURSE_UPDATE)) scope.push(sql`true`);
      if (can(PERMISSIONS.COURSE_UPDATE_OWN)) scope.push(sql`e.author_id = ${actor.userId}`);
      if (can(PERMISSIONS.COURSE_READ))
        scope.push(sql`(e.status = 'published' AND e.is_archived = false)`);
      if (can(PERMISSIONS.COURSE_READ_ASSIGNED))
        scope.push(sql`EXISTS (SELECT 1 FROM student_courses sc WHERE sc.course_id = e.id
          AND sc.student_id = ${actor.userId} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED}
          AND e.status IN (${COURSE_STATUSES.PUBLISHED}, ${COURSE_STATUSES.PRIVATE}))`);
      return sql`EXISTS (SELECT 1 FROM courses e WHERE e.id = s.entity_id
        AND (${sql.join(scope, sql` OR `)}))`;
    }
    if (type === SEARCH_ENTITY_TYPES.LESSON) {
      if (!can(PERMISSIONS.COURSE_READ)) return sql`false`;
      let scope: SQL = sql`EXISTS (SELECT 1 FROM student_courses sc WHERE sc.course_id = e.id
        AND sc.student_id = ${actor.userId} AND sc.status = ${COURSE_ENROLLMENT.ENROLLED})`;
      if (can(PERMISSIONS.COURSE_UPDATE)) scope = sql`true`;
      else if (can(PERMISSIONS.COURSE_UPDATE_OWN)) scope = sql`e.author_id = ${actor.userId}`;
      return sql`EXISTS (SELECT 1 FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id
        JOIN courses e ON e.id = ch.course_id WHERE l.id = s.entity_id AND ${scope}
          AND s.language = ANY(e.available_locales))`;
    }
    if (type === SEARCH_ENTITY_TYPES.LEARNING_PATH) {
      if (!can(PERMISSIONS.LEARNING_PATH_READ)) return sql`false`;
      const own = any([
        PERMISSIONS.LEARNING_PATH_UPDATE_OWN,
        PERMISSIONS.LEARNING_PATH_COURSE_UPDATE_OWN,
      ]);
      return sql`EXISTS (SELECT 1 FROM learning_paths e WHERE e.id = s.entity_id AND (
        e.status = ${LEARNING_PATH_STATUSES.PUBLISHED}
        OR EXISTS (SELECT 1 FROM student_learning_paths sp WHERE sp.learning_path_id = e.id AND sp.student_id = ${actor.userId})
        OR (${own} AND e.author_id = ${actor.userId})))`;
    }
    if (type === SEARCH_ENTITY_TYPES.NEWS) {
      const manage = any([PERMISSIONS.NEWS_MANAGE, PERMISSIONS.NEWS_MANAGE_OWN]);
      if (!manage && !can(PERMISSIONS.NEWS_READ_PUBLIC)) return sql`false`;
      return sql`EXISTS (SELECT 1 FROM news e WHERE e.id = s.entity_id AND e.archived = false
        AND e.published_at IS NOT NULL AND (${manage} OR s.language = ANY(e.available_locales)))`;
    }
    if (type === SEARCH_ENTITY_TYPES.ARTICLE) {
      const manage = any([PERMISSIONS.ARTICLE_MANAGE, PERMISSIONS.ARTICLE_MANAGE_OWN]);
      if (!manage && !can(PERMISSIONS.ARTICLE_READ_PUBLIC)) return sql`false`;
      return sql`EXISTS (SELECT 1 FROM articles e JOIN article_sections sec ON sec.id = e.article_section_id
        WHERE e.id = s.entity_id AND e.archived = false AND e.published_at IS NOT NULL
          AND (${manage} OR (s.language = ANY(e.available_locales) AND s.language = ANY(sec.available_locales))))`;
    }
    if (!any([PERMISSIONS.QA_READ_PUBLIC, PERMISSIONS.QA_MANAGE, PERMISSIONS.QA_MANAGE_OWN]))
      return sql`false`;
    return sql`EXISTS (SELECT 1 FROM questions_and_answers e WHERE e.id = s.entity_id
      AND (${can(PERMISSIONS.QA_MANAGE)} OR s.language = ANY(e.available_locales)))`;
  }
}
