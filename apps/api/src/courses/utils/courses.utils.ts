import { ENTITY_TYPES } from "@repo/shared";
import { sql } from "drizzle-orm";

import { RESOURCE_RELATIONSHIP_TYPES } from "src/file/file.constants";
import {
  courses,
  lessons,
  questionAnswerOptions,
  questions,
  resourceEntity,
  resources,
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
      setweight(jsonb_to_tsvector('english', ${lessons.title}, '["string"]'), 'B') ||
      setweight(jsonb_to_tsvector('english', COALESCE(${lessons.description}, '{}'::jsonb), '["string"]'), 'C') ||
      COALESCE((
        SELECT
          string_agg(
            (
              setweight(jsonb_to_tsvector('english', q.title, '["string"]'), 'B') ||
              setweight(jsonb_to_tsvector('english', COALESCE(q.description, '{}'::jsonb), '["string"]'), 'C') ||
              setweight(jsonb_to_tsvector('english', COALESCE(q.solution_explanation, '{}'::jsonb), '["string"]'), 'C') ||
              COALESCE((
                SELECT
                  string_agg(
                    jsonb_to_tsvector('english', qao.option_text, '["string"]')::text,
                    ' '
                  )
                FROM ${questionAnswerOptions} qao
                WHERE qao.question_id = q.id
              ), ''::text)::tsvector
            )::text,
            ' '
          )
        FROM ${questions} q
        WHERE q.lesson_id = ${lessons.id}
      ), ''::text)::tsvector ||
      COALESCE((
        SELECT
          string_agg(
            (
              setweight(to_tsvector('english', COALESCE(r.metadata->>'originalFilename', '')), 'D') ||
              setweight(jsonb_to_tsvector('english', COALESCE(r.title, '{}'::jsonb), '["string"]'), 'D') ||
              setweight(to_tsvector('english', regexp_replace(r.reference, '^.*/', '')), 'D')
            )::text,
            ' '
          )
        FROM ${resourceEntity} re
        INNER JOIN ${resources} r ON r.id = re.resource_id
        WHERE re.entity_id = ${lessons.id}
          AND re.entity_type = ${ENTITY_TYPES.LESSON}
          AND re.relationship_type = ${RESOURCE_RELATIONSHIP_TYPES.ATTACHMENT}
          AND r.archived = false
      ), ''::text)::tsvector
    )
  `;
}
