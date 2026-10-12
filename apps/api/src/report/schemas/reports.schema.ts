import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import {
  REPORT_VIEWS,
  REPORT_FILTER_FIELDS,
  REPORT_FILTER_OPERATORS,
  REPORT_FILTER_MATCH,
  REPORT_STATUS,
  REPORT_CERTIFICATE_STATUS,
} from "../constants/reports.constants";

import type { Static } from "@sinclair/typebox";

export {
  REPORT_VIEWS,
  REPORT_FILTER_FIELDS,
  REPORT_FILTER_OPERATORS,
} from "../constants/reports.constants";

export const reportViewSchema = Type.Enum(REPORT_VIEWS);

export const reportFilterConditionSchema = Type.Object(
  {
    field: Type.Enum(REPORT_FILTER_FIELDS),
    operator: Type.Enum(REPORT_FILTER_OPERATORS),
    value: Type.Optional(
      Type.Union([
        Type.String({ maxLength: 200 }),
        Type.Number({ minimum: 0, maximum: 1000000 }),
        Type.Array(
          Type.Union([
            Type.String({ maxLength: 200 }),
            Type.Number({ minimum: 0, maximum: 1000000 }),
          ]),
          { minItems: 1, maxItems: 30 },
        ),
      ]),
    ),
  },
  { additionalProperties: false },
);

export const reportFilterNestedGroupSchema = Type.Object(
  {
    match: Type.Enum(REPORT_FILTER_MATCH),
    rules: Type.Array(reportFilterConditionSchema, { minItems: 1, maxItems: 30 }),
  },
  { additionalProperties: false },
);

export const reportFilterSchema = Type.Object(
  {
    match: Type.Enum(REPORT_FILTER_MATCH),
    rules: Type.Array(Type.Union([reportFilterConditionSchema, reportFilterNestedGroupSchema]), {
      minItems: 1,
      maxItems: 30,
    }),
  },
  { additionalProperties: false },
);

const reportDefinitionProperties = {
  view: reportViewSchema,
  timezone: Type.String({ minLength: 1, maxLength: 100 }),
  groupIds: Type.Array(UUIDSchema, { maxItems: 100, default: [] }),
  subjectId: Type.Optional(UUIDSchema),
  filter: Type.Optional(reportFilterSchema),
};

/** What a report shows: its view, scope and conditions. Saved configurations store only this. */
export const reportDefinitionSchema = Type.Object(reportDefinitionProperties, {
  additionalProperties: false,
});

/** A report definition run in a display language and for one page of rows. */
export const reportsQuerySchema = Type.Object(
  {
    ...reportDefinitionProperties,
    language: Type.Enum(SUPPORTED_LANGUAGES),
    page: Type.Integer({ minimum: 1, default: 1 }),
    pageSize: Type.Integer({ minimum: 1, maximum: 100, default: 25 }),
  },
  { additionalProperties: false },
);

export type ReportDefinition = Static<typeof reportDefinitionSchema>;
export type ReportsQuery = Static<typeof reportsQuerySchema>;
export type ReportFilterCondition = Static<typeof reportFilterConditionSchema>;
export type ReportFilter = Static<typeof reportFilterSchema>;

export const reportStatusSchema = Type.Enum(REPORT_STATUS);

export const reportCertificateSchema = Type.Object({
  status: Type.Enum(REPORT_CERTIFICATE_STATUS),
  issuedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const reportCourseStateSchema = Type.Object({
  courseId: UUIDSchema,
  courseTitle: Type.String(),
  status: reportStatusSchema,
  progress: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  enrolledAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  completedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
});

export const reportRowSchema = Type.Object({
  id: Type.String(),
  learner: Type.Object({
    id: UUIDSchema,
    name: Type.String(),
    email: Type.String(),
  }),
  course: Type.Union([Type.Object({ id: UUIDSchema, title: Type.String() }), Type.Null()]),
  path: Type.Union([Type.Object({ id: UUIDSchema, title: Type.String() }), Type.Null()]),
  status: reportStatusSchema,
  progress: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  score: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  attempts: Type.Integer({ minimum: 0 }),
  certificate: reportCertificateSchema,
  enrolledAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  completedAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  lastActivityAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  groupIds: Type.Array(UUIDSchema),
  pathCourses: Type.Array(reportCourseStateSchema),
});

export const reportMetricsSchema = Type.Object({
  learners: Type.Integer({ minimum: 0 }),
  platformCourses: Type.Integer({ minimum: 0 }),
  activeLearners30d: Type.Integer({ minimum: 0 }),
  courseEnrollments: Type.Integer({ minimum: 0 }),
  courseCompletions: Type.Integer({ minimum: 0 }),
  courseCompletionRate: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  averageProgress: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  averageScore: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
  activeCertificates: Type.Integer({ minimum: 0 }),
  certificatesIssued: Type.Integer({ minimum: 0 }),
  developmentPathsCompleted: Type.Integer({ minimum: 0 }),
});

export const reportBreakdownSchema = Type.Object({
  id: Type.String(),
  label: Type.String(),
  learners: Type.Integer({ minimum: 0 }),
  courseEnrollments: Type.Integer({ minimum: 0 }),
  courseCompletions: Type.Integer({ minimum: 0 }),
  completionRate: Type.Union([Type.Number({ minimum: 0, maximum: 100 }), Type.Null()]),
});

export const reportsResultSchema = Type.Object({
  rows: Type.Array(reportRowSchema),
  metrics: reportMetricsSchema,
  breakdowns: Type.Object({
    groups: Type.Array(reportBreakdownSchema),
    courses: Type.Array(reportBreakdownSchema),
    paths: Type.Array(reportBreakdownSchema),
  }),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  pageSize: Type.Integer({ minimum: 1, maximum: 100 }),
  capturedAt: Type.String({ format: "date-time" }),
});
export type ReportsResult = Static<typeof reportsResultSchema>;

export const reportOptionsSchema = Type.Object({
  groups: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  learners: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  courses: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  paths: Type.Array(Type.Object({ id: UUIDSchema, label: Type.String() })),
  canManageShared: Type.Boolean(),
});
export type ReportOptions = Static<typeof reportOptionsSchema>;

export { validateReportsQuerySemantics } from "../validation/reports-query.validation";
