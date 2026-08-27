import { AUDIT_COMPETENCIES, AUDIT_TYPES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const auditTypeSchema = Type.Union([
  Type.Literal(AUDIT_TYPES.INDIVIDUAL),
  Type.Literal(AUDIT_TYPES.SCHOOL),
]);

const auditAnswerSchema = Type.Object({
  questionId: Type.String({ minLength: 1, maxLength: 100 }),
  optionId: Type.String({ minLength: 1, maxLength: 100 }),
});

export const createAuditSubmissionSchema = Type.Object({
  definitionVersion: Type.Integer({ minimum: 1 }),
  answers: Type.Array(auditAnswerSchema, { minItems: 1, maxItems: 100 }),
});

const scoreSchema = Type.Integer({ minimum: 0, maximum: 100 });
const competencyScoresSchema = Type.Partial(
  Type.Object({
    [AUDIT_COMPETENCIES.AI_LITERACY]: scoreSchema,
    [AUDIT_COMPETENCIES.AI_GOVERNANCE]: scoreSchema,
    [AUDIT_COMPETENCIES.AI_AWARENESS]: scoreSchema,
    [AUDIT_COMPETENCIES.TOOL_PROFICIENCY]: scoreSchema,
    [AUDIT_COMPETENCIES.ETHICAL_UNDERSTANDING]: scoreSchema,
    [AUDIT_COMPETENCIES.CURRICULUM_INTEGRATION]: scoreSchema,
    [AUDIT_COMPETENCIES.DATA_PRIVACY]: scoreSchema,
    [AUDIT_COMPETENCIES.SENIOR_LEADERSHIP]: scoreSchema,
    [AUDIT_COMPETENCIES.SCIENCE_TECHNOLOGY]: scoreSchema,
    [AUDIT_COMPETENCIES.HUMANITIES]: scoreSchema,
    [AUDIT_COMPETENCIES.ARTS_CREATIVE]: scoreSchema,
    [AUDIT_COMPETENCIES.ADMINISTRATION]: scoreSchema,
    [AUDIT_COMPETENCIES.SUPPORT_STAFF]: scoreSchema,
  }),
);

export const auditSubmissionResultSchema = Type.Object({
  id: UUIDSchema,
  type: auditTypeSchema,
  definitionVersion: Type.Integer(),
  score: scoreSchema,
  competencyScores: competencyScoresSchema,
  completedAt: Type.String({ format: "date-time" }),
});

export const nullableAuditSubmissionResultSchema = Type.Union([
  auditSubmissionResultSchema,
  Type.Null(),
]);

export const auditSubmissionHistorySchema = Type.Array(auditSubmissionResultSchema);

export const auditBenchmarkSchema = Type.Object({
  currentScore: Type.Union([scoreSchema, Type.Null()]),
  averageScore: Type.Union([scoreSchema, Type.Null()]),
  improvement: Type.Union([Type.Integer({ minimum: -100, maximum: 100 }), Type.Null()]),
  rank: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  participantCount: Type.Integer({ minimum: 0 }),
  comparisons: Type.Array(
    Type.Object({
      name: Type.String(),
      score: scoreSchema,
      improvement: Type.Union([Type.Integer({ minimum: -100, maximum: 100 }), Type.Null()]),
      isCurrentTenant: Type.Boolean(),
      rank: Type.Integer({ minimum: 1 }),
    }),
  ),
});

export type CreateAuditSubmissionSchema = Static<typeof createAuditSubmissionSchema>;
