-- Custom SQL migration file, put you code below! --

CREATE OR REPLACE FUNCTION pg_temp.escape_rich_text_image_attr(value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS
$$
  SELECT replace(
    replace(
      replace(
        replace(COALESCE(value, ''), '&', '&amp;'),
        '"',
        '&quot;'
      ),
      '<',
      '&lt;'
    ),
    '>',
    '&gt;'
  );
$$;

CREATE OR REPLACE FUNCTION pg_temp.strip_html_tags(value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS
$$
  SELECT btrim(regexp_replace(COALESCE(value, ''), '<[^>]+>', '', 'gi'));
$$;

CREATE OR REPLACE FUNCTION pg_temp.build_rich_text_image_node(
  src text,
  alt text,
  resource_id uuid DEFAULT NULL
)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
AS
$$
  SELECT
    '<div data-node-type="image" data-src="' ||
    pg_temp.escape_rich_text_image_attr(src) ||
    '" data-alt="' ||
    pg_temp.escape_rich_text_image_attr(alt) ||
    '"' ||
    CASE
      WHEN resource_id IS NULL THEN ''
      ELSE ' data-resource-id="' || resource_id::text || '"'
    END ||
    '></div>';
$$;

CREATE OR REPLACE FUNCTION pg_temp.extract_lesson_resource_id_from_url(src text)
  RETURNS uuid
  LANGUAGE plpgsql
  IMMUTABLE
AS
$$
DECLARE
  matches text[];
BEGIN
  matches := regexp_match(
    COALESCE(src, ''),
    'lesson-resource/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})',
    'i'
  );

  IF matches IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN matches[1]::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.migrate_content_lesson_image_nodes(
  content text,
  image_resource_ids uuid[]
)
  RETURNS text
  LANGUAGE plpgsql
AS
$$
DECLARE
  result text := content;
  resource_id uuid;
  pattern text;
  matches text[];
  alt_matches text[];
  full_match text;
  src text;
  alt text;
  raw_resource_id uuid;
BEGIN
  IF result IS NULL THEN
    RETURN result;
  END IF;

  FOREACH resource_id IN ARRAY COALESCE(image_resource_ids, ARRAY[]::uuid[]) LOOP
    FOREACH pattern IN ARRAY ARRAY[
      '(<p[^>]*>[[:space:]]*<a[^>]*href[[:space:]]*=[[:space:]]*([''"])([^''"]*lesson-resource/' ||
        resource_id::text ||
        '[^''"]*)\2[^>]*>([^<]*)</a>[[:space:]]*</p>)',
      '(<a[^>]*href[[:space:]]*=[[:space:]]*([''"])([^''"]*lesson-resource/' ||
        resource_id::text ||
        '[^''"]*)\2[^>]*>([^<]*)</a>)'
    ] LOOP
      LOOP
        matches := regexp_match(result, pattern, 'is');

        IF matches IS NULL THEN
          EXIT;
        END IF;

        full_match := matches[1];
        src := matches[3];
        alt := pg_temp.strip_html_tags(matches[4]);

        result := replace(
          result,
          full_match,
          pg_temp.build_rich_text_image_node(src, alt, resource_id)
        );
      END LOOP;
    END LOOP;
  END LOOP;

  LOOP
    matches := regexp_match(
      result,
      '(<img[^>]*src[[:space:]]*=[[:space:]]*([''"])([^''"]+)\2[^>]*>)',
      'is'
    );

    IF matches IS NULL THEN
      EXIT;
    END IF;

    full_match := matches[1];
    src := matches[3];
    raw_resource_id := pg_temp.extract_lesson_resource_id_from_url(src);
    alt_matches := regexp_match(full_match, 'alt[[:space:]]*=[[:space:]]*([''"])([^''"]*)\1', 'is');
    alt := CASE WHEN alt_matches IS NULL THEN '' ELSE alt_matches[2] END;

    result := replace(
      result,
      full_match,
      pg_temp.build_rich_text_image_node(src, alt, raw_resource_id)
    );
  END LOOP;

  RETURN result;
END;
$$;

WITH content_lessons AS (
  SELECT
    l.id,
    l.description,
    COALESCE(
      array_agg(r.id) FILTER (WHERE r.id IS NOT NULL),
      ARRAY[]::uuid[]
    ) AS image_resource_ids
  FROM lessons l

  LEFT JOIN resource_entity re
    ON re.entity_id = l.id
    AND re.entity_type = 'lesson'
    AND re.relationship_type = 'attachment'

  LEFT JOIN resources r
    ON r.id = re.resource_id
    AND r.content_type ILIKE 'image/%'

  WHERE l.type = 'content'
    AND l.description IS NOT NULL
    AND jsonb_typeof(l.description) = 'object'
    AND (
      l.description::text ILIKE '%<img%'
      OR l.description::text ILIKE '%lesson-resource/%'
    )

  GROUP BY l.id, l.description
),
migrated_descriptions AS (
  SELECT
    content_lessons.id,
    jsonb_object_agg(
      description_entry.key,
      to_jsonb(
        pg_temp.migrate_content_lesson_image_nodes(
          description_entry.value,
          content_lessons.image_resource_ids
        )
      )
    ) AS description
  FROM content_lessons

  CROSS JOIN LATERAL jsonb_each_text(content_lessons.description) AS description_entry(key, value)

  GROUP BY content_lessons.id
)
UPDATE lessons l
SET description = migrated_descriptions.description
FROM migrated_descriptions
WHERE l.id = migrated_descriptions.id
  AND l.description IS DISTINCT FROM migrated_descriptions.description;
