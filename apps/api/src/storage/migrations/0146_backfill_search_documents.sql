WITH docs AS (
  SELECT
    c.tenant_id,
    'course'::text AS entity_type,
    c.id AS entity_id,
    'title'::text AS document_type,
    title.lang AS language,
    title.value AS content,
    'A'::"char" AS weight,
    '{}'::jsonb AS metadata
  FROM courses c
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(c.title) = 'object' THEN c.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(c.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    c.tenant_id,
    'course',
    c.id,
    'description',
    description.lang,
    description.value,
    'B'::"char",
    '{}'::jsonb
  FROM courses c
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(c.description) = 'object' THEN c.description ELSE '{}'::jsonb END
  ) AS description(lang, value)
  WHERE description.lang = ANY(c.available_locales) AND length(trim(description.value)) > 0

  UNION ALL

  SELECT
    lp.tenant_id,
    'learning_path',
    lp.id,
    'title',
    title.lang,
    title.value,
    'A'::"char",
    '{}'::jsonb
  FROM learning_paths lp
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(lp.title) = 'object' THEN lp.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(lp.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    lp.tenant_id,
    'learning_path',
    lp.id,
    'description',
    description.lang,
    description.value,
    'B'::"char",
    '{}'::jsonb
  FROM learning_paths lp
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(lp.description) = 'object' THEN lp.description ELSE '{}'::jsonb END
  ) AS description(lang, value)
  WHERE description.lang = ANY(lp.available_locales) AND length(trim(description.value)) > 0

  UNION ALL

  SELECT
    n.tenant_id,
    'news',
    n.id,
    'title',
    title.lang,
    title.value,
    'A'::"char",
    '{}'::jsonb
  FROM news n
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(n.title) = 'object' THEN n.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(n.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    n.tenant_id,
    'news',
    n.id,
    'summary',
    summary.lang,
    summary.value,
    'B'::"char",
    '{}'::jsonb
  FROM news n
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(n.summary) = 'object' THEN n.summary ELSE '{}'::jsonb END
  ) AS summary(lang, value)
  WHERE summary.lang = ANY(n.available_locales) AND length(trim(summary.value)) > 0

  UNION ALL

  SELECT
    n.tenant_id,
    'news',
    n.id,
    'content',
    content.lang,
    content.value,
    'C'::"char",
    '{}'::jsonb
  FROM news n
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(n.content) = 'object' THEN n.content ELSE '{}'::jsonb END
  ) AS content(lang, value)
  WHERE content.lang = ANY(n.available_locales) AND length(trim(content.value)) > 0

  UNION ALL

  SELECT
    a.tenant_id,
    'articles',
    a.id,
    'title',
    title.lang,
    title.value,
    'A'::"char",
    '{}'::jsonb
  FROM articles a
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(a.title) = 'object' THEN a.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(a.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    a.tenant_id,
    'articles',
    a.id,
    'summary',
    summary.lang,
    summary.value,
    'B'::"char",
    '{}'::jsonb
  FROM articles a
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(a.summary) = 'object' THEN a.summary ELSE '{}'::jsonb END
  ) AS summary(lang, value)
  WHERE summary.lang = ANY(a.available_locales) AND length(trim(summary.value)) > 0

  UNION ALL

  SELECT
    a.tenant_id,
    'articles',
    a.id,
    'content',
    content.lang,
    content.value,
    'C'::"char",
    '{}'::jsonb
  FROM articles a
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(a.content) = 'object' THEN a.content ELSE '{}'::jsonb END
  ) AS content(lang, value)
  WHERE content.lang = ANY(a.available_locales) AND length(trim(content.value)) > 0

  UNION ALL

  SELECT
    qa.tenant_id,
    'qa',
    qa.id,
    'title',
    title.lang,
    title.value,
    'A'::"char",
    '{}'::jsonb
  FROM questions_and_answers qa
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(qa.title) = 'object' THEN qa.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(qa.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    qa.tenant_id,
    'qa',
    qa.id,
    'description',
    description.lang,
    description.value,
    'B'::"char",
    '{}'::jsonb
  FROM questions_and_answers qa
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(qa.description) = 'object' THEN qa.description ELSE '{}'::jsonb END
  ) AS description(lang, value)
  WHERE description.lang = ANY(qa.available_locales) AND length(trim(description.value)) > 0

  UNION ALL

  SELECT
    l.tenant_id,
    'lesson',
    l.id,
    'title',
    title.lang,
    title.value,
    'B'::"char",
    '{}'::jsonb
  FROM lessons l
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(l.title) = 'object' THEN l.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(c.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    l.tenant_id,
    'lesson',
    l.id,
    'description',
    description.lang,
    description.value,
    'C'::"char",
    '{}'::jsonb
  FROM lessons l
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(l.description) = 'object' THEN l.description ELSE '{}'::jsonb END
  ) AS description(lang, value)
  WHERE description.lang = ANY(c.available_locales) AND length(trim(description.value)) > 0

  UNION ALL

  SELECT
    q.tenant_id,
    'lesson',
    q.lesson_id,
    'question_title:' || q.id::text,
    title.lang,
    title.value,
    'B'::"char",
    jsonb_build_object('sliceType', 'question_title', 'questionId', q.id)
  FROM questions q
  INNER JOIN lessons l ON l.id = q.lesson_id
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(q.title) = 'object' THEN q.title ELSE '{}'::jsonb END
  ) AS title(lang, value)
  WHERE title.lang = ANY(c.available_locales) AND length(trim(title.value)) > 0

  UNION ALL

  SELECT
    q.tenant_id,
    'lesson',
    q.lesson_id,
    'question_description:' || q.id::text,
    description.lang,
    description.value,
    'C'::"char",
    jsonb_build_object('sliceType', 'question_description', 'questionId', q.id)
  FROM questions q
  INNER JOIN lessons l ON l.id = q.lesson_id
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(q.description) = 'object' THEN q.description ELSE '{}'::jsonb END
  ) AS description(lang, value)
  WHERE description.lang = ANY(c.available_locales) AND length(trim(description.value)) > 0

  UNION ALL

  SELECT
    q.tenant_id,
    'lesson',
    q.lesson_id,
    'question_solution_explanation:' || q.id::text,
    explanation.lang,
    explanation.value,
    'C'::"char",
    jsonb_build_object('sliceType', 'question_solution_explanation', 'questionId', q.id)
  FROM questions q
  INNER JOIN lessons l ON l.id = q.lesson_id
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(q.solution_explanation) = 'object' THEN q.solution_explanation ELSE '{}'::jsonb END
  ) AS explanation(lang, value)
  WHERE explanation.lang = ANY(c.available_locales) AND length(trim(explanation.value)) > 0

  UNION ALL

  SELECT
    qao.tenant_id,
    'lesson',
    q.lesson_id,
    'answer_option:' || qao.id::text,
    option_text.lang,
    option_text.value,
    'C'::"char",
    jsonb_build_object(
      'sliceType', 'answer_option',
      'questionId', q.id,
      'answerOptionId', qao.id
    )
  FROM question_answer_options qao
  INNER JOIN questions q ON q.id = qao.question_id
  INNER JOIN lessons l ON l.id = q.lesson_id
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL jsonb_each_text(
    CASE WHEN jsonb_typeof(qao.option_text) = 'object' THEN qao.option_text ELSE '{}'::jsonb END
  ) AS option_text(lang, value)
  WHERE option_text.lang = ANY(c.available_locales) AND length(trim(option_text.value)) > 0

  UNION ALL

  SELECT
    re.tenant_id,
    'lesson',
    re.entity_id,
    'resource:' || r.id::text,
    locale.lang,
    trim(concat_ws(
      ' ',
      COALESCE(NULLIF(r.metadata->>'originalFilename', ''), NULLIF(regexp_replace(r.reference, '^.*/', ''), '')),
      COALESCE(r.title->>locale.lang, '')
    )),
    'D'::"char",
    jsonb_build_object(
      'sliceType', 'resource',
      'resourceId', r.id,
      'fileName', COALESCE(NULLIF(r.metadata->>'originalFilename', ''), NULLIF(regexp_replace(r.reference, '^.*/', ''), ''))
    )
  FROM resource_entity re
  INNER JOIN resources r ON r.id = re.resource_id
  INNER JOIN lessons l ON l.id = re.entity_id
  INNER JOIN chapters ch ON ch.id = l.chapter_id
  INNER JOIN courses c ON c.id = ch.course_id
  CROSS JOIN LATERAL unnest(c.available_locales) AS locale(lang)
  WHERE re.entity_type = 'lesson'
    AND re.relationship_type = 'attachment'
    AND r.archived = false
    AND length(trim(concat_ws(
      ' ',
      COALESCE(NULLIF(r.metadata->>'originalFilename', ''), NULLIF(regexp_replace(r.reference, '^.*/', ''), '')),
      COALESCE(r.title->>locale.lang, '')
    ))) > 0
)
INSERT INTO search_documents (
  tenant_id,
  entity_type,
  entity_id,
  document_type,
  language,
  content,
  search_vector,
  metadata
)
SELECT
  docs.tenant_id,
  docs.entity_type,
  docs.entity_id,
  docs.document_type,
  docs.language,
  trim(docs.content),
  setweight(
    to_tsvector(
      'simple'::regconfig,
      trim(docs.content)
    ),
    docs.weight
  ),
  docs.metadata
FROM docs
WHERE length(trim(docs.content)) > 0
ON CONFLICT (tenant_id, entity_type, entity_id, document_type, language)
DO UPDATE SET
  content = EXCLUDED.content,
  search_vector = EXCLUDED.search_vector,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;
