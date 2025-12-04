-- Custom SQL migration file, put you code below! --
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'title_json'
  ) THEN
ALTER TABLE courses DROP COLUMN IF EXISTS title;
ALTER TABLE courses DROP COLUMN IF EXISTS description;
ALTER TABLE courses RENAME COLUMN title_json TO title;
ALTER TABLE courses RENAME COLUMN description_json TO description;
END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chapters' AND column_name = 'title_json'
  ) THEN
ALTER TABLE chapters DROP COLUMN IF EXISTS title;
ALTER TABLE chapters RENAME COLUMN title_json TO title;
END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'lessons' AND column_name = 'title_json'
  ) THEN
ALTER TABLE lessons DROP COLUMN IF EXISTS title;
ALTER TABLE lessons DROP COLUMN IF EXISTS description;
ALTER TABLE lessons RENAME COLUMN title_json TO title;
ALTER TABLE lessons RENAME COLUMN description_json TO description;
END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'title_json'
  ) THEN
ALTER TABLE questions DROP COLUMN IF EXISTS title;
ALTER TABLE questions DROP COLUMN IF EXISTS description;
ALTER TABLE questions DROP COLUMN IF EXISTS solution_explanation;
ALTER TABLE questions RENAME COLUMN title_json TO title;
ALTER TABLE questions RENAME COLUMN description_json TO description;
ALTER TABLE questions RENAME COLUMN solution_explanation_json TO solution_explanation;
END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'question_answer_options' AND column_name = 'matched_word_json'
  ) THEN
ALTER TABLE question_answer_options DROP COLUMN IF EXISTS matched_word;
ALTER TABLE question_answer_options DROP COLUMN IF EXISTS option_text;
ALTER TABLE question_answer_options RENAME COLUMN matched_word_json TO matched_word;
ALTER TABLE question_answer_options RENAME COLUMN option_text_json TO option_text;
END IF;
END;
$$;

COMMIT;
