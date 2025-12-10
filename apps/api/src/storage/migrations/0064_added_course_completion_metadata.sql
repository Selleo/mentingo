-- Custom SQL migration file, put you code below! --

UPDATE student_courses
SET course_completion_metadata = jsonb_set(COALESCE(course_completion_metadata, '{}'::jsonb), '{completed_language}', '"en"', true)
WHERE completed_at IS NOT NULL;