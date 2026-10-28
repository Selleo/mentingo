import {
  COMPETENCY_READINESS,
  CONDITION_ASSESSMENT_REASONS,
  CONDITION_KINDS,
  CONDITION_OVERRIDE_STATUSES,
  EVIDENCE_KINDS,
  EVIDENCE_STATUSES,
  LEARNING_FACT_OUTCOMES,
  REVIEW_DECISIONS,
} from "@mentingo/competencies-sdk";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema, pagination } from "src/common";

import {
  COMPETENCIES_BOOLEAN_QUERY_VALUES,
  COMPETENCIES_COMMAND_OPERATIONS,
} from "../competencies.constants";

const nullableString = Type.Union([Type.String(), Type.Null()]);
const nullableNumber = Type.Union([Type.Number(), Type.Null()]);
const nullableUUID = Type.Union([UUIDSchema, Type.Null()]);

export const COMPETENCIES_UNCATEGORIZED = "none";
export const COMPETENCIES_DEFAULT_PAGE_SIZE = 20;
export const COMPETENCIES_MAX_PAGE_SIZE = 100;

const conditionKindSchema = Type.Enum(CONDITION_KINDS);
const evidenceKindSchema = Type.Enum(EVIDENCE_KINDS);
const evidenceStatusSchema = Type.Enum(EVIDENCE_STATUSES);
const readinessSchema = Type.Enum(COMPETENCY_READINESS);
const overrideStatusSchema = Type.Enum(CONDITION_OVERRIDE_STATUSES);

export const competencyConditionSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 100 }),
    kind: conditionKindSchema,
    description: Type.String({ minLength: 1, maxLength: 2000 }),
    resourceId: Type.Optional(UUIDSchema),
    verifierIds: Type.Optional(Type.Array(UUIDSchema)),
  },
  { additionalProperties: false },
);
const levelSchema = Type.Object(
  {
    id: Type.String({ minLength: 1, maxLength: 100 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    conditions: Type.Array(competencyConditionSchema),
  },
  { additionalProperties: false },
);
export const competencyInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ maxLength: 10000 }),
    categoryId: nullableUUID,
    levels: Type.Array(levelSchema),
  },
  { additionalProperties: false },
);
const competencySchema = Type.Object({
  id: UUIDSchema,
  revision: Type.Integer(),
  archived: Type.Boolean(),
  name: Type.String(),
  description: Type.String(),
  categoryId: nullableUUID,
  levels: Type.Array(levelSchema),
});
const competencyWithCategorySchema = Type.Composite([
  competencySchema,
  Type.Object({ categoryName: nullableString }),
]);
const catalogItemSchema = Type.Composite([
  competencyWithCategorySchema,
  Type.Object({ profileCount: Type.Integer() }),
]);
const categorySchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  revision: Type.Integer(),
  competencyCount: Type.Integer(),
});
const requirementSchema = Type.Object(
  { competencyId: UUIDSchema, levelId: Type.String({ minLength: 1, maxLength: 100 }) },
  { additionalProperties: false },
);
const profileInputSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ maxLength: 10000 }),
    requirements: Type.Array(requirementSchema),
  },
  { additionalProperties: false },
);
const profileSchema = Type.Object({
  id: UUIDSchema,
  revision: Type.Integer(),
  name: Type.String(),
  description: Type.String(),
  requirements: Type.Array(requirementSchema),
});
const profileListItemSchema = Type.Composite([
  profileSchema,
  Type.Object({ assignedPeopleCount: Type.Integer() }),
]);
export const evidenceInputSchema = Type.Object(
  {
    requestId: UUIDSchema,
    subjectId: UUIDSchema,
    competencyId: UUIDSchema,
    conditionIds: Type.Array(Type.String(), { minItems: 1 }),
    kind: evidenceKindSchema,
    occurredAt: Type.String({ format: "date-time" }),
    validUntil: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
    note: Type.String({ minLength: 1, maxLength: 10000 }),
    attachmentId: Type.Optional(UUIDSchema),
  },
  { additionalProperties: false },
);
const evidenceSchema = Type.Composite([
  evidenceInputSchema,
  Type.Object({
    id: UUIDSchema,
    version: Type.Integer(),
    conditionRevisions: Type.Record(Type.String(), Type.String()),
    status: evidenceStatusSchema,
    createdBy: UUIDSchema,
    reviewedBy: nullableUUID,
    reviewedAt: nullableString,
    reason: nullableString,
  }),
]);
const reviewItemSchema = Type.Composite([
  evidenceSchema,
  Type.Object({
    subjectName: nullableString,
    subjectProfilePictureUrl: nullableString,
    competencyName: Type.String(),
    conditions: Type.Array(
      Type.Object({
        id: Type.String(),
        kind: conditionKindSchema,
        description: Type.String(),
        levelId: Type.String(),
        levelName: Type.String(),
        levelNumber: Type.Integer(),
      }),
    ),
  }),
]);
const conditionAssessmentSchema = Type.Object({
  conditionId: Type.String(),
  met: Type.Boolean(),
  reason: Type.Union([Type.Enum(CONDITION_ASSESSMENT_REASONS), Type.Null()]),
  evidenceIds: Type.Array(Type.String()),
  effectiveFrom: nullableString,
  effectiveUntil: nullableString,
});
const standingSchema = Type.Object({
  competencyId: UUIDSchema,
  attainedLevelId: nullableString,
  attainedLevelName: nullableString,
  currentLevelId: nullableString,
  effectiveFrom: nullableString,
  effectiveUntil: nullableString,
  expiring: Type.Boolean(),
  levels: Type.Array(
    Type.Object({
      levelId: Type.String(),
      met: Type.Boolean(),
      metUntil: nullableString,
      conditions: Type.Array(conditionAssessmentSchema),
    }),
  ),
});
const assessmentSchema = Type.Object({
  subjectId: UUIDSchema,
  profileId: nullableUUID,
  profileRevision: nullableNumber,
  asOf: Type.String(),
  coverage: nullableNumber,
  metCount: Type.Integer(),
  requirementCount: Type.Integer(),
  readiness: readinessSchema,
  requirements: Type.Array(
    Type.Object({
      requirement: requirementSchema,
      met: Type.Boolean(),
      expiring: Type.Boolean(),
      standing: standingSchema,
    }),
  ),
});
const overrideSchema = Type.Object({
  id: UUIDSchema,
  subjectId: UUIDSchema,
  competencyId: UUIDSchema,
  competencyRevision: Type.Integer(),
  conditionId: Type.String(),
  conditionRevision: Type.String(),
  status: overrideStatusSchema,
  comment: Type.String(),
  createdAt: Type.String(),
  createdBy: UUIDSchema,
  isCurrent: Type.Boolean(),
});
const revocationSchema = Type.Object({
  id: UUIDSchema,
  subjectId: UUIDSchema,
  competencyId: UUIDSchema,
  conditionIds: Type.Array(Type.String()),
  reason: Type.String(),
  revokedAt: Type.String(),
  revokedBy: UUIDSchema,
});
const personNameSchema = Type.Object({ id: UUIDSchema, name: Type.String() });
const personWithAvatarSchema = Type.Composite([
  personNameSchema,
  Type.Object({ profilePictureUrl: nullableString }),
]);

const requiredRevision = Type.Integer({ minimum: 1 });
const optionalRevision = Type.Optional(requiredRevision);
export const competenciesCommandSchema = Type.Union([
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SAVE_CATEGORY),
      id: Type.Optional(UUIDSchema),
      revision: optionalRevision,
      name: Type.String({ minLength: 1, maxLength: 200, pattern: "\\S" }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.DELETE_CATEGORY),
      id: UUIDSchema,
      revision: requiredRevision,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SAVE_COMPETENCY),
      id: Type.Optional(UUIDSchema),
      revision: optionalRevision,
      value: competencyInputSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.DELETE_COMPETENCY),
      id: UUIDSchema,
      revision: requiredRevision,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SAVE_PROFILE),
      id: Type.Optional(UUIDSchema),
      revision: optionalRevision,
      value: profileInputSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.DELETE_PROFILE),
      id: UUIDSchema,
      revision: requiredRevision,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.ASSIGN_PROFILE),
      subjectId: UUIDSchema,
      profileId: nullableUUID,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SUBMIT_EVIDENCE),
      value: evidenceInputSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.REVIEW_EVIDENCE),
      id: UUIDSchema,
      subjectId: UUIDSchema,
      version: requiredRevision,
      decision: Type.Enum(REVIEW_DECISIONS),
      reason: Type.String({ minLength: 1, maxLength: 10000, pattern: "\\S" }),
      requestId: UUIDSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.REVOKE_CONFIRMATION),
      requestId: UUIDSchema,
      subjectId: UUIDSchema,
      competencyId: UUIDSchema,
      revision: requiredRevision,
      conditionIds: Type.Array(Type.String(), { minItems: 1 }),
      reason: Type.String({ minLength: 1, maxLength: 10000, pattern: "\\S" }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SET_CONDITION_OVERRIDE),
      requestId: UUIDSchema,
      subjectId: UUIDSchema,
      competencyId: UUIDSchema,
      revision: requiredRevision,
      conditionId: Type.String(),
      status: overrideStatusSchema,
      comment: Type.String({ minLength: 1, maxLength: 10000, pattern: "\\S" }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      operation: Type.Literal(COMPETENCIES_COMMAND_OPERATIONS.SETTINGS),
      warningDays: Type.Union([Type.Integer({ minimum: 0, maximum: 3650 }), Type.Null()]),
    },
    { additionalProperties: false },
  ),
]);

const pageQuery = {
  page: Type.Optional(Type.Integer({ minimum: 1, maximum: 1_000_000 })),
  perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: COMPETENCIES_MAX_PAGE_SIZE })),
  search: Type.Optional(Type.String({ maxLength: 200 })),
};
const booleanQuery = Type.Optional(
  Type.Union([
    Type.Literal(COMPETENCIES_BOOLEAN_QUERY_VALUES.TRUE),
    Type.Literal(COMPETENCIES_BOOLEAN_QUERY_VALUES.FALSE),
  ]),
);

export const competencyCategoriesQuerySchema = Type.Object(pageQuery);
export const competencyCatalogQuerySchema = Type.Object({
  ...pageQuery,
  categoryId: Type.Optional(Type.Union([UUIDSchema, Type.Literal(COMPETENCIES_UNCATEGORIZED)])),
  archived: booleanQuery,
});
export const competencyProfilesQuerySchema = Type.Object({
  ...pageQuery,
  competencyId: Type.Optional(UUIDSchema),
});
export const competencyPeopleQuerySchema = Type.Object({
  ...pageQuery,
  profileId: Type.Optional(UUIDSchema),
  readiness: Type.Optional(readinessSchema),
  teamOnly: booleanQuery,
});
export const competencyMatrixQuerySchema = Type.Object({
  ...pageQuery,
  profileId: UUIDSchema,
  teamOnly: booleanQuery,
});
export const competencyReviewsQuerySchema = Type.Object({
  ...pageQuery,
  status: evidenceStatusSchema,
  competencyId: Type.Optional(UUIDSchema),
});
export const competencyDocumentsQuerySchema = Type.Object({
  page: pageQuery.page,
  perPage: pageQuery.perPage,
});
export const competencySubjectQuerySchema = Type.Object({
  profileId: Type.Optional(UUIDSchema),
});
export const competencyOptionsQuerySchema = Type.Object({
  language: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
});

export const competenciesConfigurationSchema = Type.Object({
  enabled: Type.Boolean(),
  canManage: Type.Boolean(),
  canPlan: Type.Boolean(),
});
export const competenciesSummarySchema = Type.Object({
  warningDays: nullableNumber,
  isVerifier: Type.Boolean(),
  pendingReviewCount: Type.Integer(),
  setup: Type.Object({
    competencies: Type.Integer(),
    profiles: Type.Integer(),
    assignments: Type.Integer(),
  }),
});
export const competencyCategoriesPageSchema = Type.Object({
  data: Type.Array(categorySchema),
  pagination,
});
export const competencyCatalogPageSchema = Type.Object({
  data: Type.Array(catalogItemSchema),
  pagination,
});
export const competencyProfilesPageSchema = Type.Object({
  data: Type.Array(profileListItemSchema),
  pagination,
});
const readinessCountsSchema = Type.Object({
  all: Type.Integer(),
  no_profile: Type.Integer(),
  missing: Type.Integer(),
  expiring: Type.Integer(),
  met: Type.Integer(),
});
export const competencyPeoplePageSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      id: UUIDSchema,
      name: Type.String(),
      profileId: nullableUUID,
      profileName: nullableString,
      profilePictureUrl: nullableString,
      metCount: Type.Integer(),
      requirementCount: Type.Integer(),
      readiness: readinessSchema,
    }),
  ),
  pagination,
  counts: readinessCountsSchema,
});
export const competencyMatrixPageSchema = Type.Object({
  data: Type.Array(
    Type.Object({
      person: personNameSchema,
      cells: Type.Array(
        Type.Object({
          competencyId: UUIDSchema,
          requiredLevelId: Type.String(),
          currentLevelId: nullableString,
          met: Type.Boolean(),
          expiring: Type.Boolean(),
          metUntil: nullableString,
        }),
      ),
    }),
  ),
  pagination,
  profile: profileSchema,
  competencies: Type.Array(competencyWithCategorySchema),
});
export const competencyReviewsPageSchema = Type.Object({
  data: Type.Array(reviewItemSchema),
  pagination,
  counts: Type.Object({
    pending: Type.Integer(),
    approved: Type.Integer(),
    rejected: Type.Integer(),
    revoked: Type.Integer(),
  }),
});
export const competencyDocumentsPageSchema = Type.Object({
  data: Type.Array(evidenceSchema),
  pagination,
});
export const competencySubjectSchema = Type.Object({
  asOf: Type.String(),
  warningDays: nullableNumber,
  person: Type.Union([personWithAvatarSchema, Type.Null()]),
  profile: Type.Union([profileSchema, Type.Null()]),
  assessment: Type.Union([assessmentSchema, Type.Null()]),
  competencies: Type.Array(competencyWithCategorySchema),
  standings: Type.Array(standingSchema),
  evidence: Type.Array(evidenceSchema),
  overrides: Type.Array(overrideSchema),
  revocations: Type.Array(revocationSchema),
  canPlan: Type.Boolean(),
  people: Type.Array(personNameSchema),
});
export const competencyOptionsSchema = Type.Object({
  courses: Type.Array(personNameSchema),
  people: Type.Array(personNameSchema),
});
export const competencyCommandResultSchema = Type.Object({ id: Type.String() });
export const learningFactSchema = Type.Object({
  courseId: UUIDSchema,
  id: Type.String(),
  revision: Type.Integer(),
  subjectId: UUIDSchema,
  kind: Type.Literal(CONDITION_KINDS.COURSE),
  resourceId: UUIDSchema,
  learningStateId: nullableUUID,
  occurredAt: Type.String(),
  validUntil: nullableString,
  outcome: Type.Enum(LEARNING_FACT_OUTCOMES),
});

export type CompetenciesCommandBody = Static<typeof competenciesCommandSchema>;
export type CompetenciesConfigurationResponse = Static<typeof competenciesConfigurationSchema>;
export type CompetenciesSummaryResponse = Static<typeof competenciesSummarySchema>;
export type CompetencyCategoriesQuery = Static<typeof competencyCategoriesQuerySchema>;
export type CompetencyCategoriesPageResponse = Static<typeof competencyCategoriesPageSchema>;
export type CompetencyCatalogQuery = Static<typeof competencyCatalogQuerySchema>;
export type CompetencyCatalogPageResponse = Static<typeof competencyCatalogPageSchema>;
export type CompetencyProfilesQuery = Static<typeof competencyProfilesQuerySchema>;
export type CompetencyProfilesPageResponse = Static<typeof competencyProfilesPageSchema>;
export type CompetencyPeopleQuery = Static<typeof competencyPeopleQuerySchema>;
export type CompetencyPeoplePageResponse = Static<typeof competencyPeoplePageSchema>;
export type CompetencyMatrixQuery = Static<typeof competencyMatrixQuerySchema>;
export type CompetencyMatrixPageResponse = Static<typeof competencyMatrixPageSchema>;
export type CompetencyReviewsQuery = Static<typeof competencyReviewsQuerySchema>;
export type CompetencyReviewsPageResponse = Static<typeof competencyReviewsPageSchema>;
export type CompetencyDocumentsQuery = Static<typeof competencyDocumentsQuerySchema>;
export type CompetencyDocumentsPageResponse = Static<typeof competencyDocumentsPageSchema>;
export type CompetencySubjectQuery = Static<typeof competencySubjectQuerySchema>;
export type CompetencySubjectResponse = Static<typeof competencySubjectSchema>;
export type CompetencyOptionsQuery = Static<typeof competencyOptionsQuerySchema>;
export type CompetencyOptionsResponse = Static<typeof competencyOptionsSchema>;
export type CompetencyCommandResponse = Static<typeof competencyCommandResultSchema>;
