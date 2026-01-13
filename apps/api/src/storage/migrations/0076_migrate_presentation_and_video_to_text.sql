-- Custom SQL migration file, put you code below! --

UPDATE lessons SET type = 'content' WHERE type = 'text';

WITH resource_data AS (
    SELECT l.id id, c.author_id author
    FROM lessons l
    JOIN chapters ch ON ch.id = l.chapter_id
    JOIN courses c ON c.id = ch.course_id
)
INSERT INTO resources (created_at, updated_at, title, description, reference, content_type, metadata, uploaded_by_id, archived)
SELECT l.created_at, l.updated_at, l.title, l.title, l.file_s3_key, l.file_type, json_build_object('lessonId', l.id), rd.author, FALSE
FROM lessons l
JOIN resource_data rd ON rd.id = l.id
WHERE l.type IN ('presentation', 'video');

INSERT INTO resource_entity (created_at, updated_at, resource_id, entity_id, entity_type, relationship_type)
SELECT r.created_at, r.updated_at, r.id, (r.metadata->>'lessonId')::uuid, 'lesson', 'attachment'
FROM resources r
WHERE r.metadata ? 'lessonId'
ON CONFLICT (resource_id, entity_id, entity_type, relationship_type) DO NOTHING;

WITH resource_data AS (
    SELECT l.id AS lesson_id, c.base_language AS base_language
    FROM lessons l
    JOIN chapters ch ON ch.id = l.chapter_id
    JOIN courses c ON c.id = ch.course_id
)
UPDATE lessons
SET file_s3_key = NULL,
    file_type = NULL,
    type = 'content'
FROM resource_data rd
WHERE lessons.id = rd.lesson_id AND lessons.type IN ('presentation', 'video');
