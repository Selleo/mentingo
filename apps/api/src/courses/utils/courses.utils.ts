import { sql } from "drizzle-orm";

import {
  courses,
  lessonResources,
  lessons,
  questionAnswerOptions,
  questions,
} from "src/storage/schema";

export function getCourseTsVector() {
  return sql`
    (
      setweight(jsonb_to_tsvector('english', ${courses.title}, '["string"]'), 'A') ||
      setweight(jsonb_to_tsvector('english', COALESCE(${courses.description}, '{}'::jsonb), '["string"]'), 'B')
    )
  `;
}

export function getLessonTsVector() {
  return sql`
    (
      (
        setweight(jsonb_to_tsvector('english', ${lessons.title}, '["string"]'), 'B') ||
        setweight(jsonb_to_tsvector('english', COALESCE(${lessons.description}, '{}'::jsonb), '["string"]'), 'C') ||
        COALESCE((
          SELECT
            string_agg(
              setweight(jsonb_to_tsvector('english', q.title, '["string"]'), 'B') ||
              setweight(jsonb_to_tsvector('english', COALESCE(q.description, '{}'::jsonb), '["string"]'), 'C') ||
              setweight(jsonb_to_tsvector('english', COALESCE(q.solution_explanation, '{}'::jsonb), '["string"]'), 'C') ||
              (
                SELECT
                  string_agg(
                    jsonb_to_tsvector('english', qao.option_text, '["string"]')::text,
                    ' '
                  )
                FROM ${questionAnswerOptions} qao
                WHERE qao.question_id = q.id
              )::tsvector,
              ' '
            )::tsvector
          FROM ${questions} q
          WHERE q.lesson_id = ${lessons.id}
        ), ''::tsvector) ||
        COALESCE((
          SELECT
            string_agg(
              to_tsvector('english', regexp_replace(regexp_replace(COALESCE(lr.source, ''), '<[^>]+>', '', 'g'), '&[^;]+;', '', 'g'))::text,
              ' '
            )::tsvector
          FROM ${lessonResources} lr
          WHERE lr.lesson_id = ${lessons.id}
        ), ''::tsvector)
      ) 
    )
  `;
}
