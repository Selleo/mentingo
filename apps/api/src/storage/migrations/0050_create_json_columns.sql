-- Custom SQL migration file, put you code below! --
BEGIN;

ALTER TABLE courses ADD COLUMN IF NOT EXISTS title_json jsonb;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS description_json jsonb;

ALTER TABLE chapters ADD COLUMN IF NOT EXISTS title_json jsonb;

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS title_json jsonb;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS description_json jsonb;

ALTER TABLE questions ADD COLUMN IF NOT EXISTS title_json jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS description_json jsonb;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution_explanation_json jsonb;

ALTER TABLE question_answer_options ADD COLUMN IF NOT EXISTS option_text_json jsonb;
ALTER TABLE question_answer_options ADD COLUMN IF NOT EXISTS matched_word_json jsonb;

COMMIT;