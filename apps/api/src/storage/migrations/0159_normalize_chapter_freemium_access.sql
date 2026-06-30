-- Custom SQL migration file, put you code below! --
UPDATE chapters
SET is_freemium = FALSE
FROM courses
LEFT JOIN settings global_settings
  ON global_settings.tenant_id = courses.tenant_id
  AND global_settings.user_id IS NULL
WHERE chapters.course_id = courses.id
  AND chapters.is_freemium = TRUE
  AND (
    NOT EXISTS (
      SELECT 1
      FROM lessons
      WHERE lessons.chapter_id = chapters.id
    )
    OR EXISTS (
      SELECT 1
      FROM lessons
      WHERE lessons.chapter_id = chapters.id
        AND lessons.type <> 'content'
    )
    OR (
      courses.price_in_cents = 0
      AND COALESCE(
        (global_settings.settings->>'unregisteredUserCoursesAccessibility')::BOOLEAN,
        FALSE
      ) = FALSE
    )
  );
