import type { ReportResult } from "./reports-api.types";
import type { BREAKDOWN_STATUSES } from "../constants/reportCharts.constants";

export type BreakdownKind = keyof ReportResult["breakdowns"];

export type ReportBreakdownItem = ReportResult["breakdowns"]["courses"][number];

export type BreakdownStatus = (typeof BREAKDOWN_STATUSES)[keyof typeof BREAKDOWN_STATUSES];

export type BreakdownStatusBar = ReportBreakdownItem &
  Record<BreakdownStatus, number> & { completionLabel: string };

export type ReportLearningInsights = NonNullable<ReportResult["learningInsights"]>;

export type LearningFunnelStep = keyof ReportLearningInsights["funnel"];
