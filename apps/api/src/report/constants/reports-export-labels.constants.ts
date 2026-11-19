import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { CS_REPORT_EXPORT_LABELS } from "./export-labels/cs.export-labels";
import { DE_REPORT_EXPORT_LABELS } from "./export-labels/de.export-labels";
import { EN_REPORT_EXPORT_LABELS } from "./export-labels/en.export-labels";
import { ES_REPORT_EXPORT_LABELS } from "./export-labels/es.export-labels";
import { FR_REPORT_EXPORT_LABELS } from "./export-labels/fr.export-labels";
import { LT_REPORT_EXPORT_LABELS } from "./export-labels/lt.export-labels";
import { PL_REPORT_EXPORT_LABELS } from "./export-labels/pl.export-labels";

import type { SupportedLanguages } from "@repo/shared";

export type ReportExportLabels = Record<keyof typeof EN_REPORT_EXPORT_LABELS, string>;

export const REPORT_EXPORT_LABELS: Record<SupportedLanguages, ReportExportLabels> = {
  [SUPPORTED_LANGUAGES.EN]: EN_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.PL]: PL_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.DE]: DE_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.LT]: LT_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.CS]: CS_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.ES]: ES_REPORT_EXPORT_LABELS,
  [SUPPORTED_LANGUAGES.FR]: FR_REPORT_EXPORT_LABELS,
};
