import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import {
  REPORT_CONFIGURATION_VISIBILITY,
  REPORT_FAILURE_CODE,
} from "../constants/reports.constants";

import { reportDefinitionSchema } from "./reports.schema";

import type { Static } from "@sinclair/typebox";

export const reportConfigurationVisibilitySchema = Type.Enum(REPORT_CONFIGURATION_VISIBILITY);

export const createReportConfigurationSchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    visibility: reportConfigurationVisibilitySchema,
    query: reportDefinitionSchema,
  },
  { additionalProperties: false },
);
export type CreateReportConfiguration = Static<typeof createReportConfigurationSchema>;

export const updateReportConfigurationSchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    visibility: Type.Optional(reportConfigurationVisibilitySchema),
    query: Type.Optional(reportDefinitionSchema),
  },
  { additionalProperties: false, minProperties: 1 },
);
export type UpdateReportConfiguration = Static<typeof updateReportConfigurationSchema>;

export const reportConfigurationSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  visibility: reportConfigurationVisibilitySchema,
  query: reportDefinitionSchema,
  ownerId: UUIDSchema,
  isAvailable: Type.Boolean(),
  failureCode: Type.Union([Type.Literal(REPORT_FAILURE_CODE.INACCESSIBLE_REFERENCE), Type.Null()]),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});
export type ReportConfigurationResponse = Static<typeof reportConfigurationSchema>;

export const reportConfigurationsListSchema = Type.Array(reportConfigurationSchema);
export type ReportConfigurationsListResponse = Static<typeof reportConfigurationsListSchema>;
