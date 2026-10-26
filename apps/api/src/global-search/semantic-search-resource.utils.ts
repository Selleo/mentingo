import { RESOURCE_VISIBILITY, SUPPORTED_LANGUAGES } from "@repo/shared";
import { sql } from "drizzle-orm";

import { SEARCH_EXTRACTABLE_FILE_TYPES } from "src/ingestion/ingestion.config";
import { RICH_TEXT_RELATIONSHIP_TYPES } from "src/resource-library/resource-library.constants";

import { SEARCH_ENTITY_TYPES } from "./global-search.constants";

/** Canonical file bindings, scoped before projecting search sources. No file/provider I/O. */
export function semanticSearchResourceSources(tenantId: string) {
  return sql`
    WITH entity_locales AS (
      SELECT ${SEARCH_ENTITY_TYPES.LESSON}::text AS entity_type, l.id AS entity_id,
        l.tenant_id, c.available_locales AS locales
      FROM lessons l JOIN chapters ch ON ch.id = l.chapter_id AND ch.tenant_id = l.tenant_id
        JOIN courses c ON c.id = ch.course_id AND c.tenant_id = ch.tenant_id
      WHERE l.tenant_id = ${tenantId}
      UNION ALL
      SELECT ${SEARCH_ENTITY_TYPES.ARTICLE}, id, tenant_id, available_locales
        FROM articles WHERE tenant_id = ${tenantId} AND archived = false
      UNION ALL
      SELECT ${SEARCH_ENTITY_TYPES.NEWS}, id, tenant_id, available_locales
        FROM news WHERE tenant_id = ${tenantId} AND archived = false
    ), resource_sources AS (
      SELECT DISTINCT ON (e.entity_type, e.entity_id, r.id, locale.lang)
        e.tenant_id, e.entity_type, e.entity_id, 'resource:' || r.id::text AS document_type,
        locale.lang AS language,
        trim(concat_ws(' ',
          coalesce(nullif(r.metadata->>'originalFilename', ''),
            nullif(regexp_replace(r.reference, '^.*/', ''), '')),
          r.title->>locale.lang)) AS content,
        jsonb_build_object('sliceType', 'resource', 'resourceId', r.id,
          'fileName', coalesce(nullif(r.metadata->>'originalFilename', ''),
            nullif(regexp_replace(r.reference, '^.*/', ''), '')),
          'semanticResource', true) AS metadata
      FROM entity_locales e
      JOIN resource_entity re ON re.entity_type = e.entity_type AND re.entity_id = e.entity_id
        AND re.tenant_id = e.tenant_id
      JOIN resources r ON r.id = re.resource_id AND r.tenant_id = e.tenant_id
      CROSS JOIN LATERAL unnest(e.locales) AS locale(lang)
      WHERE re.relationship_type IN (${sql.join(
        RICH_TEXT_RELATIONSHIP_TYPES.map((type) => sql`${type}`),
        sql`, `,
      )})
        AND r.archived = false AND r.visibility <> ${RESOURCE_VISIBILITY.HIDDEN}
        AND r.content_type IN (${sql.join(
          SEARCH_EXTRACTABLE_FILE_TYPES.map((type) => sql`${type}`),
          sql`, `,
        )})
        AND locale.lang IN (${sql.join(
          Object.values(SUPPORTED_LANGUAGES).map((language) => sql`${language}`),
          sql`, `,
        )})
    )
  `;
}
