-- Custom SQL migration file, put you code below! --

DELETE FROM resource_entity re
USING lessons l
WHERE re.entity_id = l.id
  AND re.entity_type = 'lesson'
  AND re.relationship_type = 'attachment'
  AND l.type = 'content'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_each_text(COALESCE(l.description, '{}'::jsonb)) AS localized_description(
      language,
      content
    )
    WHERE localized_description.content ILIKE '%' || re.resource_id::text || '%'
  );
