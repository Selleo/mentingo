-- Custom SQL migration file, put you code below! --

DO $$
DECLARE
  course_row record;
  metadata jsonb;
BEGIN
  FOR course_row IN
    SELECT id, author_metadata
    FROM courses
    WHERE jsonb_typeof(author_metadata) = 'string'
  LOOP
    BEGIN
      metadata := (course_row.author_metadata #>> '{}')::jsonb;
    EXCEPTION WHEN invalid_text_representation THEN
      CONTINUE;
    END;

    IF jsonb_typeof(metadata) = 'object' THEN
      UPDATE courses SET author_metadata = metadata WHERE id = course_row.id;
    END IF;
  END LOOP;
END
$$;
