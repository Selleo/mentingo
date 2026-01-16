-- Custom SQL migration file, put you code below! --

-- Full-text search GIN indexes for lesson content
-- These are functional indexes that compute tsvector on the fly

-- Lessons: search title and description (JSONB fields)
CREATE INDEX IF NOT EXISTS lessons_search_idx ON lessons USING GIN (
    (
    setweight(jsonb_to_tsvector('english', title, '["string"]'), 'A') ||
    setweight(jsonb_to_tsvector('english', COALESCE(description, '{}'::jsonb), '["string"]'), 'B')
    )
    );

-- Questions: search title, description, and solution explanation
CREATE INDEX IF NOT EXISTS questions_search_idx ON questions USING GIN (
    (
    setweight(jsonb_to_tsvector('english', title, '["string"]'), 'A') ||
    setweight(jsonb_to_tsvector('english', COALESCE(description, '{}'::jsonb), '["string"]'), 'B') ||
    setweight(jsonb_to_tsvector('english', COALESCE(solution_explanation, '{}'::jsonb), '["string"]'), 'C')
    )
    );

-- Question answer options: search option text
CREATE INDEX IF NOT EXISTS question_answer_options_search_idx ON question_answer_options USING GIN (
    jsonb_to_tsvector('english', option_text, '["string"]')
    );

-- News: search title, summary, and content (JSONB fields)
CREATE INDEX IF NOT EXISTS news_search_idx ON news USING GIN (
    (
    setweight(jsonb_to_tsvector('english', title, '["string"]'), 'A') ||
    setweight(jsonb_to_tsvector('english', COALESCE(summary, '{}'::jsonb), '["string"]'), 'B') ||
    setweight(jsonb_to_tsvector('english', COALESCE(content, '{}'::jsonb), '["string"]'), 'C')
    )
    );

-- Articles: search title, summary, and content (JSONB fields)
CREATE INDEX IF NOT EXISTS articles_search_idx ON articles USING GIN (
    (
    setweight(jsonb_to_tsvector('english', title, '["string"]'), 'A') ||
    setweight(jsonb_to_tsvector('english', COALESCE(summary, '{}'::jsonb), '["string"]'), 'B') ||
    setweight(jsonb_to_tsvector('english', COALESCE(content, '{}'::jsonb), '["string"]'), 'C')
    )
    );

-- Q&A: search title and description (JSONB fields)
CREATE INDEX IF NOT EXISTS questions_and_answers_search_idx ON questions_and_answers USING GIN (
    (
    setweight(jsonb_to_tsvector('english', title, '["string"]'), 'A') ||
    setweight(jsonb_to_tsvector('english', COALESCE(description, '{}'::jsonb), '["string"]'), 'B')
    )
    );

