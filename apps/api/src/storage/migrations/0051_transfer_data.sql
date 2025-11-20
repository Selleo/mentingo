-- Custom SQL migration file
BEGIN;

UPDATE courses SET title_json = json_build_object('en', title)::jsonb, description_json = json_build_object('en', description)::jsonb;
UPDATE chapters SET title_json = json_build_object('en', title)::jsonb;
UPDATE lessons SET title_json = json_build_object('en', title)::jsonb, description_json = json_build_object('en', description)::jsonb;
UPDATE questions SET title_json = json_build_object('en', title)::jsonb, description_json = json_build_object('en', description)::jsonb, solution_explanation_json = json_build_object('en', solution_explanation)::jsonb;
UPDATE question_answer_options SET option_text_json = json_build_object('en', option_text)::jsonb, matched_word_json = json_build_object('en', matched_word)::jsonb;

COMMIT;