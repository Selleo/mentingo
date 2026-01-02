-- Custom SQL migration file, put you code below! --

WITH resource_data AS (
    SELECT l.id lesson_id, l.title title, l.title description, c.author_id author
    FROM lessons l
    JOIN chapters ch ON ch.id = l.chapter_id
    JOIN courses c ON c.id = ch.course_id
)
INSERT INTO resources (id, created_at, updated_at, title, description, reference, content_type, metadata, uploaded_by_id, archived)
SELECT
    lr.id,
    lr.created_at,
    lr.updated_at,
    rd.title title,
    rd.description description,
    lr.source,
    lr.type,
    json_build_object('allowFullscreen', lr.allow_fullscreen, 'lessonId', lr.lesson_id),
    rd.author,
    FALSE
FROM lesson_resources lr JOIN resource_data rd ON rd.lesson_id = lr.lesson_id;

INSERT INTO resource_entity (created_at, updated_at, resource_id, entity_id, entity_type, relationship_type)
SELECT r.created_at, r.updated_at, r.id, (r.metadata->>'lessonId')::uuid, 'lesson', 'attachment'
FROM resources r
WHERE r.metadata ? 'lessonId' = TRUE;

DELETE FROM lesson_resources;