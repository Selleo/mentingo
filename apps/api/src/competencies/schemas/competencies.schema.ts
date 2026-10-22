import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
export const competencyConditionSchema = Type.Object(
  {
    id: Type.String(),
    kind: Type.Union([
      Type.Literal("course"),
      Type.Literal("quiz"),
      Type.Literal("ai-mentor"),
      Type.Literal("observation"),
      Type.Literal("document"),
    ]),
    description: Type.String(),
    resourceId: Type.Optional(UUIDSchema),
    minimumScore: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    verifierIds: Type.Optional(Type.Array(Type.String({ format: "uuid" }))),
  },
  { additionalProperties: false },
);
const levelSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  conditions: Type.Array(competencyConditionSchema),
});
export const competencyInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    category: Type.String(),
    levels: Type.Array(levelSchema),
  },
  { additionalProperties: false },
);
const competencySchema = Type.Composite([
  competencyInputSchema,
  Type.Object({
    id: UUIDSchema,
    revision: Type.Integer(),
    archived: Type.Boolean(),
  }),
]);
const requirementSchema = Type.Object({
  competencyId: UUIDSchema,
  levelId: Type.String(),
});
const profileInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    description: Type.String(),
    requirements: Type.Array(requirementSchema),
  },
  { additionalProperties: false },
);
const profileSchema = Type.Composite([
  profileInputSchema,
  Type.Object({
    id: UUIDSchema,
    revision: Type.Integer(),
    status: Type.Union([Type.Literal("published"), Type.Literal("archived")]),
  }),
]);
export const evidenceInputSchema = Type.Object(
  {
    requestId: UUIDSchema,
    subjectId: UUIDSchema,
    competencyId: UUIDSchema,
    conditionIds: Type.Array(Type.String(), { minItems: 1 }),
    kind: Type.Union([
      Type.Literal("observation"),
      Type.Literal("document"),
      Type.Literal("recognition"),
    ]),
    occurredAt: Type.String({ format: "date-time" }),
    validUntil: nullableString,
    note: Type.String({ minLength: 1 }),
    attachmentId: Type.Optional(UUIDSchema),
    actionId: Type.Optional(UUIDSchema),
  },
  { additionalProperties: false },
);
const evidenceStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("approved"),
  Type.Literal("rejected"),
  Type.Literal("revoked"),
]);
const evidenceSchema = Type.Composite([
  evidenceInputSchema,
  Type.Object({
    id: UUIDSchema,
    version: Type.Integer(),
    conditionRevisions: Type.Record(Type.String(), Type.String(), {
      additionalProperties: Type.String(),
    }),
    status: evidenceStatusSchema,
    createdBy: UUIDSchema,
    reviewedBy: nullableString,
    reviewedAt: nullableString,
    reason: nullableString,
  }),
]);
const conditionAssessmentSchema = Type.Object({
  conditionId: Type.String(),
  met: Type.Boolean(),
  reason: nullableString,
  evidenceIds: Type.Array(Type.String()),
  effectiveFrom: nullableString,
  effectiveUntil: nullableString,
});
const standingSchema = Type.Object({
  competencyId: UUIDSchema,
  attainedLevelId: nullableString,
  currentLevelId: nullableString,
  effectiveFrom: nullableString,
  effectiveUntil: nullableString,
  attainedLevelName: Type.Optional(nullableString),
  expiring: Type.Boolean(),
  levels: Type.Array(
    Type.Object({
      levelId: Type.String(),
      met: Type.Boolean(),
      conditions: Type.Array(conditionAssessmentSchema),
    }),
  ),
});
const assessmentSchema = Type.Object({
  subjectId: UUIDSchema,
  profileId: nullableString,
  profileRevision: nullableNumber,
  asOf: Type.String(),
  coverage: nullableNumber,
  metCount: Type.Integer(),
  requirementCount: Type.Integer(),
  requirements: Type.Array(
    Type.Object({ requirement: requirementSchema, met: Type.Boolean(), standing: standingSchema }),
  ),
});
const actionStatusSchema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("in_progress"),
  Type.Literal("completed"),
  Type.Literal("cancelled"),
]);
const assignmentStatusSchema = Type.Union([
  Type.Literal("not_requested"),
  Type.Literal("pending"),
  Type.Literal("confirmed"),
  Type.Literal("failed"),
]);
const actionInputSchema = Type.Object(
  {
    subjectId: UUIDSchema,
    competencyId: UUIDSchema,
    levelId: Type.String(),
    objective: Type.String({ minLength: 1 }),
    kind: Type.Union([
      Type.Literal("course"),
      Type.Literal("practice"),
      Type.Literal("instruction"),
      Type.Literal("mentoring"),
      Type.Literal("renewal"),
    ]),
    ownerId: UUIDSchema,
    dueDate: nullableString,
    courseId: Type.Optional(UUIDSchema),
  },
  { additionalProperties: false },
);
const actionSchema = Type.Composite([
  actionInputSchema,
  Type.Object({
    id: UUIDSchema,
    version: Type.Integer(),
    competencyRevision: Type.Integer(),
    profileId: nullableString,
    profileRevision: nullableNumber,
    status: actionStatusSchema,
    assignmentStatus: assignmentStatusSchema,
    assignmentRequestId: nullableString,
    createdBy: UUIDSchema,
  }),
]);

export const competenciesCommandSchema = Type.Union([
  Type.Object({
    operation: Type.Literal("save_competency"),
    id: Type.Optional(UUIDSchema),
    revision: Type.Optional(Type.Integer()),
    value: competencyInputSchema,
  }),
  Type.Object({
    operation: Type.Literal("archive_competency"),
    id: UUIDSchema,
    revision: Type.Integer(),
  }),
  Type.Object({
    operation: Type.Literal("save_profile"),
    id: Type.Optional(UUIDSchema),
    revision: Type.Optional(Type.Integer()),
    value: profileInputSchema,
  }),
  Type.Object({
    operation: Type.Literal("delete_profile"),
    id: UUIDSchema,
    revision: Type.Integer({ minimum: 1 }),
  }),
  Type.Object({
    operation: Type.Literal("assign_profile"),
    subjectId: UUIDSchema,
    profileId: nullableString,
  }),
  Type.Object({ operation: Type.Literal("submit_evidence"), value: evidenceInputSchema }),
  Type.Object({
    operation: Type.Literal("revoke_confirmation"),
    requestId: UUIDSchema,
    subjectId: UUIDSchema,
    competencyId: UUIDSchema,
    revision: Type.Integer({ minimum: 1 }),
    conditionIds: Type.Array(Type.String(), { minItems: 1 }),
    reason: Type.String({ minLength: 1, maxLength: 10000 }),
  }),
  Type.Object({
    operation: Type.Literal("review_evidence"),
    id: UUIDSchema,
    subjectId: UUIDSchema,
    version: Type.Integer(),
    decision: Type.Union([
      Type.Literal("approved"),
      Type.Literal("rejected"),
      Type.Literal("revoked"),
    ]),
    reason: Type.String({ minLength: 1 }),
    requestId: UUIDSchema,
  }),
  Type.Object({ operation: Type.Literal("settings"), warningDays: nullableNumber }),
  Type.Object({
    operation: Type.Literal("create_action"),
    value: actionInputSchema,
    requestId: UUIDSchema,
  }),
  Type.Object({
    operation: Type.Literal("update_action"),
    id: UUIDSchema,
    subjectId: UUIDSchema,
    version: Type.Integer(),
    status: actionStatusSchema,
    objective: Type.String({ minLength: 1 }),
    ownerId: UUIDSchema,
    dueDate: nullableString,
  }),
  Type.Object({
    operation: Type.Literal("set_condition_override"),
    requestId: UUIDSchema,
    subjectId: UUIDSchema,
    competencyId: UUIDSchema,
    revision: Type.Integer(),
    conditionId: Type.String(),
    status: Type.Union([Type.Literal("met"), Type.Literal("automatic")]),
    comment: Type.String({ minLength: 1, pattern: "\\S" }),
  }),
]);
export const competenciesConfigurationSchema = Type.Object({
  enabled: Type.Boolean(),
  canManage: Type.Boolean(),
  canPlan: Type.Boolean(),
});
export const competenciesWorkspaceSchema = Type.Object({
  revocations: Type.Array(
    Type.Object({
      id: UUIDSchema,
      subjectId: UUIDSchema,
      competencyId: UUIDSchema,
      conditionIds: Type.Array(Type.String()),
      reason: Type.String(),
      revokedAt: Type.String(),
      revokedBy: UUIDSchema,
    }),
  ),
  catalog: Type.Array(competencySchema),
  profiles: Type.Array(profileSchema),
  publishedProfiles: Type.Array(profileSchema),
  subjects: Type.Array(Type.Object({ id: UUIDSchema, profileId: nullableString })),
  verifiers: Type.Record(Type.String(), Type.Array(Type.String()), {
    additionalProperties: Type.Array(Type.String()),
  }),
  conditionOverrides: Type.Array(
    Type.Object({
      id: UUIDSchema,
      requestId: UUIDSchema,
      subjectId: UUIDSchema,
      competencyId: UUIDSchema,
      conditionId: Type.String(),
      conditionRevision: Type.String(),
      isCurrent: Type.Boolean(),
      competencyRevision: Type.Optional(Type.Integer()),
      status: Type.Union([Type.Literal("met"), Type.Literal("automatic")]),
      comment: Type.String(),
      createdAt: Type.String(),
      createdBy: UUIDSchema,
    }),
  ),
  evidence: Type.Array(evidenceSchema),
  standings: Type.Array(Type.Object({ subjectId: UUIDSchema, standing: standingSchema })),
  assessments: Type.Array(assessmentSchema),
  actions: Type.Array(actionSchema),
  actionHistory: Type.Array(actionSchema),
  warningDays: nullableNumber,
  asOf: Type.String(),
  evidenceHistory: Type.Array(evidenceSchema),
  awardHistory: Type.Array(
    Type.Object({
      subjectId: UUIDSchema,
      competencyId: UUIDSchema,
      ruleRevision: Type.Integer(),
      recordedAt: Type.String(),
      standing: standingSchema,
    }),
  ),
  people: Type.Array(
    Type.Object({
      id: UUIDSchema,
      name: Type.String(),
      archived: Type.Boolean(),
      canPlan: Type.Boolean(),
    }),
  ),
  courses: Type.Array(Type.Object({ id: UUIDSchema, name: Type.String() })),
  learningResources: Type.Array(
    Type.Object({ id: UUIDSchema, name: Type.String(), kind: Type.String(), courseId: UUIDSchema }),
  ),
});
export const competencyCommandResultSchema = Type.Object({ id: Type.String() });
export const competencyAssignmentBodySchema = Type.Object(
  { id: UUIDSchema, requestId: UUIDSchema, subjectId: UUIDSchema },
  { additionalProperties: false },
);
export const learningFactSchema = Type.Object({
  courseId: UUIDSchema,
  id: Type.String(),
  revision: Type.Integer(),
  subjectId: UUIDSchema,
  kind: Type.Union([Type.Literal("course"), Type.Literal("quiz"), Type.Literal("ai-mentor")]),
  resourceId: UUIDSchema,
  learningStateId: nullableString,
  occurredAt: Type.String(),
  validUntil: nullableString,
  outcome: Type.Union([Type.Literal("passed"), Type.Literal("failed"), Type.Literal("revoked")]),
  score: nullableNumber,
});
export const learningFactsPageSchema = Type.Object({
  facts: Type.Array(learningFactSchema),
  nextCursor: nullableString,
});
export const competencyRecordsQuerySchema = Type.Object({
  kind: Type.Union([
    Type.Literal("actions"),
    Type.Literal("documents"),
    Type.Literal("action-history"),
    Type.Literal("action-evidence"),
    Type.Literal("review-pending"),
    Type.Literal("review-history"),
  ]),
  subjectId: Type.Optional(UUIDSchema),
  actionId: Type.Optional(UUIDSchema),
  page: Type.String({ pattern: "^[1-9][0-9]{0,5}$" }),
  pageSize: Type.Union([
    Type.Literal("10"),
    Type.Literal("20"),
    Type.Literal("50"),
    Type.Literal("100"),
  ]),
});
export const competencyRecordsPageSchema = Type.Object({
  actions: Type.Array(actionSchema),
  evidence: Type.Array(evidenceSchema),
  total: Type.Integer({ minimum: 0 }),
  people: competenciesWorkspaceSchema.properties.people,
});
export type CompetencyRecordsQueryParams = Static<typeof competencyRecordsQuerySchema>;
export type CompetencyRecordsPageResponse = Static<typeof competencyRecordsPageSchema>;
export type CompetenciesCommandBody = Static<typeof competenciesCommandSchema>;
export type CompetenciesConfigurationResponse = Static<typeof competenciesConfigurationSchema>;
export type CompetenciesWorkspaceResponse = Static<typeof competenciesWorkspaceSchema>;
export type CompetencyCommandResponse = Static<typeof competencyCommandResultSchema>;
export type CompetencyAssignmentBody = Static<typeof competencyAssignmentBodySchema>;
export type LearningFactsPageResponse = Static<typeof learningFactsPageSchema>;
