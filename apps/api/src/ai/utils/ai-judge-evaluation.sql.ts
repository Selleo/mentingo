import { sql, type SQLWrapper } from "drizzle-orm";

import {
  aiJudgeCriteria,
  aiMentorJudgementBlockingErrors,
  aiMentorJudgementCriteria,
} from "src/storage/schema";

export function buildAiJudgeCriterionEvaluationsSql(
  judgementId: SQLWrapper,
  criterionTitle: SQLWrapper,
  learnerSafeFeedback: SQLWrapper = aiMentorJudgementCriteria.learnerSafeFeedback,
) {
  return sql`
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'criterionId', ${aiMentorJudgementCriteria.criterionId},
            'title', ${criterionTitle},
            'awardedScore', ${aiMentorJudgementCriteria.awardedPoints},
            'maxScore', ${aiMentorJudgementCriteria.maxScoreAtJudgement},
            'status', ${aiMentorJudgementCriteria.status},
            'learnerSafeFeedback', ${learnerSafeFeedback}
          )
          ORDER BY ${aiMentorJudgementCriteria.createdAt}
        )
        FROM ${aiMentorJudgementCriteria}
        LEFT JOIN ${aiJudgeCriteria}
          ON ${aiJudgeCriteria.id} = ${aiMentorJudgementCriteria.criterionId}
        WHERE ${aiMentorJudgementCriteria.judgementId} = ${judgementId}
      ),
      '[]'::jsonb
    )
  `;
}

export function buildAiJudgeBlockingErrorEvaluationsSql(judgementId: SQLWrapper) {
  return sql`
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'blockingErrorId', ${aiMentorJudgementBlockingErrors.blockingErrorId},
            'description', ${aiMentorJudgementBlockingErrors.blockingErrorDescription},
            'learnerSafeFeedback', ${aiMentorJudgementBlockingErrors.learnerSafeFeedback}
          )
          ORDER BY ${aiMentorJudgementBlockingErrors.createdAt}
        )
        FROM ${aiMentorJudgementBlockingErrors}
        WHERE ${aiMentorJudgementBlockingErrors.judgementId} = ${judgementId}
      ),
      '[]'::jsonb
    )
  `;
}
