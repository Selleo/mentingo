-- AI Mentor configuration is copied from the managing course. Restore the
-- localized values for already shared lessons from their source lesson maps;
-- avatar references are intentionally left untouched because they are
-- tenant-owned storage references.
UPDATE ai_mentor_lessons AS target_mentor
SET
  ai_mentor_instructions = source_mentor.ai_mentor_instructions,
  name = source_mentor.name,
  type = source_mentor.type,
  voice_mode = source_mentor.voice_mode,
  tts_preset = source_mentor.tts_preset,
  custom_tts_reference = source_mentor.custom_tts_reference
FROM master_course_entity_map AS lesson_map
INNER JOIN master_course_exports AS export_link
  ON export_link.id = lesson_map.export_id
INNER JOIN lessons AS source_lesson
  ON source_lesson.id = lesson_map.source_entity_id
INNER JOIN chapters AS source_chapter
  ON source_chapter.id = source_lesson.chapter_id
INNER JOIN courses AS source_course
  ON source_course.id = source_chapter.course_id
INNER JOIN ai_mentor_lessons AS source_mentor
  ON source_mentor.lesson_id = source_lesson.id
WHERE lesson_map.entity_type = 'lesson'
  AND target_mentor.lesson_id = lesson_map.target_entity_id
  AND export_link.source_course_id = source_course.id
  AND (
    target_mentor.ai_mentor_instructions IS DISTINCT FROM source_mentor.ai_mentor_instructions
    OR target_mentor.name IS DISTINCT FROM source_mentor.name
    OR target_mentor.type IS DISTINCT FROM source_mentor.type
    OR target_mentor.voice_mode IS DISTINCT FROM source_mentor.voice_mode
    OR target_mentor.tts_preset IS DISTINCT FROM source_mentor.tts_preset
    OR target_mentor.custom_tts_reference IS DISTINCT FROM source_mentor.custom_tts_reference
  );
