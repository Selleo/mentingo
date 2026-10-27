import { sql } from "drizzle-orm";

import { courses } from "src/storage/schema";

import type { SupportedLanguages } from "@repo/shared";

export const localizedLearningOutcomesSql = (
  language: SupportedLanguages,
  useBaseLanguageFallback = false,
) => {
  if (useBaseLanguageFallback) {
    return sql<string[]>`
        ARRAY(
          SELECT jsonb_array_elements_text(
            CASE
              WHEN jsonb_typeof(${courses.learningOutcomes}->${language}) = 'array'
                AND jsonb_array_length(${courses.learningOutcomes}->${language}) > 0
                THEN ${courses.learningOutcomes}->${language}
              WHEN jsonb_typeof(${courses.learningOutcomes}->${courses.baseLanguage}) = 'array'
                THEN ${courses.learningOutcomes}->${courses.baseLanguage}
              ELSE '[]'::jsonb
            END
          )
        )
      `;
  }

  return sql<string[]>`
      ARRAY(
        SELECT jsonb_array_elements_text(
          CASE
            WHEN jsonb_typeof(${courses.learningOutcomes}->${language}) = 'array'
              THEN ${courses.learningOutcomes}->${language}
            ELSE '[]'::jsonb
          END
        )
      )
    `;
};
