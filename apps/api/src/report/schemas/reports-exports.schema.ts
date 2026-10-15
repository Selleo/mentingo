import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { REPORT_EXPORT_FORMAT, REPORT_EXPORT_STATUS } from "../constants/reports.constants";

import { reportsQuerySchema } from "./reports.schema";

import type { Static } from "@sinclair/typebox";

export const reportExportFormatSchema = Type.Enum(REPORT_EXPORT_FORMAT);
export const createReportExportSchema = Type.Object(
  {
    format: reportExportFormatSchema,
    language: Type.Enum(SUPPORTED_LANGUAGES),
    query: reportsQuerySchema,
  },
  { additionalProperties: false },
);
export type CreateReportExport = Static<typeof createReportExportSchema>;

export const reportExportStatusSchema = Type.Enum(REPORT_EXPORT_STATUS);

export const reportExportSchema = Type.Object({
  id: UUIDSchema,
  format: reportExportFormatSchema,
  status: reportExportStatusSchema,
  expiresAt: Type.Union([Type.String({ format: "date-time" }), Type.Null()]),
  failureCode: Type.Union([Type.String(), Type.Null()]),
});
export type ReportExportResponse = Static<typeof reportExportSchema>;
