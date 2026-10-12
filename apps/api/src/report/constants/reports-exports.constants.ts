import type { ReportExportColumnKey } from "../reports-exports.types";

export const REPORT_EXPORT_RETENTION_MS = 24 * 60 * 60 * 1000;
export const REPORT_EXPORT_PROCESSING_LEASE_MS = 2 * 60 * 1000;
export const REPORT_EXPORT_PROCESSING_HEARTBEAT_MS = 30 * 1000;
export const REPORT_EXPORT_CLEANUP_BATCH_SIZE = 100;
export const REPORT_EXPORT_CLAIM_RETRY_DELAY_MS = 5000;
export const REPORT_EXPORT_CONTENT_TYPES = {
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
} as const;

/**
 * How records sheet columns are sized, in characters: wide enough for the longest value,
 * capped at `max`, but never narrower than the column's label so headers do not wrap.
 */
export const REPORT_EXPORT_RECORDS_COLUMN_FIT = {
  min: 8,
  max: 45,
  /** Covers the one-character indent on each side of a cell plus some breathing room. */
  padding: 4,
  /** Header labels are bold, so they need a little more room than plain text. */
  headerScale: 1.15,
} as const;

/** Characters a date takes in the records sheet ("20 Aug 2026"). */
export const REPORT_EXPORT_DATE_DISPLAY_LENGTH = 11;

/** Shown in place of a missing value. */
export const REPORT_EXPORT_EMPTY_VALUE = "-";

/** Marks each applied filter condition in the exports. */
export const REPORT_EXPORT_LIST_MARKER = "-";

/** Columns the PDF leaves out to fit an A4 page; the email sits under the learner's name instead. */
export const REPORT_EXPORT_PDF_OMITTED_COLUMNS = new Set<ReportExportColumnKey>([
  "email",
  "certificateIssuedAt",
]);

/** PDF table column widths, as a share of the page width. */
export const REPORT_EXPORT_PDF_COLUMN_WIDTHS: Record<ReportExportColumnKey, number> = {
  learner: 19,
  email: 0,
  course: 18,
  path: 11,
  status: 8,
  progress: 9,
  score: 6,
  attempts: 6,
  certificate: 7,
  certificateIssuedAt: 0,
  enrolledAt: 7,
  completedAt: 7,
  lastActivityAt: 7,
  pathCourses: 24,
};

/** Brand colours shared by the spreadsheet and PDF exports. */
export const REPORT_EXPORT_COLORS = {
  primary: "#3F58B6",
  primaryDark: "#384995",
  primaryLight: "#F2F5FC",
  border: "#E5E5E5",
  muted: "#64748B",
  text: "#363636",
  stripe: "#FAFAFA",
  card: "#F3F5F9",
  white: "#FFFFFF",
  success: "#116B51",
  warning: "#88510B",
} as const;

/** Excel number formats used by the spreadsheet export. */
export const REPORT_EXPORT_XLSX_FORMATS = {
  percent: "0%",
  count: "#,##0",
  date: "d mmm yyyy",
} as const;

/**
 * The summary sheet grid, in characters: narrow gutters around three card columns,
 * each card spanning a wide label column and a narrower value column.
 */
export const REPORT_EXPORT_SUMMARY_COLUMN_WIDTHS = [2, 24, 12, 2, 24, 12, 2, 24, 12, 2] as const;

/** Summary sheet columns where each of the three cards in a row starts. */
export const REPORT_EXPORT_SUMMARY_CARD_COLUMNS = [1, 4, 7] as const;

/** Height of the summary's first row, left empty because the workbook freezes every sheet's first row. */
export const REPORT_EXPORT_SUMMARY_SPACER_HEIGHT = 8;

/** Summary sheet cells that a full-width row spans: everything between the outer gutters. */
export const REPORT_EXPORT_SUMMARY_CONTENT_SPAN = 8;

/** Summary sheet columns between an activity label and its value, ruled to join them visually. */
export const REPORT_EXPORT_SUMMARY_RULE_COLUMNS = [2, 3, 4, 5, 6, 7] as const;

/** Percent metrics at or above this value are highlighted as strong results. */
export const REPORT_EXPORT_STRONG_RESULT_PERCENT = 80;

export const REPORT_EXPORT_PDF_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; font: 9px/1.45 Arial, "Helvetica Neue", sans-serif; color: #363636; }
  h1 { margin: 2px 0 0; font-size: 20px; line-height: 1.2; color: #1f2937; }
  h2 { margin: 0 0 8px; font-size: 12px; color: #1f2937; }
  section { margin-top: 18px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; padding: 14px 18px; border-radius: 8px; background: #384995; color: #FFFFFF; }
  .header h1 { margin: 0; font-size: 20px; color: #FFFFFF; }
  .header p { margin: 3px 0 0; opacity: 0.85; }
  .caption { margin: 0 0 6px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #64748B; }
  .metrics { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
  .metric { padding: 9px 12px; border-radius: 6px; background: #F3F5F9; }
  .metric-label { display: block; font-size: 8px; color: #64748B; }
  .metric-value { display: block; margin-top: 2px; font-size: 18px; font-weight: 700; color: #1f2937; }
  .metric-value-strong { color: #116B51; }
  .panel { padding: 12px 14px; border-radius: 8px; background: #F3F5F9; }
  .metric-list { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0 24px; }
  .metric-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #E5E5E5; }
  .filters { display: flex; gap: 48px; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #E5E5E5; }
  .filter-label { display: block; font-size: 8px; color: #64748B; }
  .filter strong { font-size: 11px; }
  .conditions { margin: 0; padding: 0; list-style: none; }
  .conditions li { padding: 2px 0; }
  .conditions li.condition::before { content: "-"; display: inline-block; width: 12px; font-weight: 700; color: #64748B; }
  .bar { display: inline-block; width: 100%; height: 4px; background: #E5E5E5; border-radius: 2px; overflow: hidden; vertical-align: middle; }
  .bar span { display: block; height: 100%; background: #3F58B6; }
  .section-heading { display: flex; justify-content: space-between; align-items: baseline; }
  .section-heading span { color: #64748B; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  th { padding: 6px; text-align: left; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #FFFFFF; background: #3F58B6; }
  td { padding: 6px; border-bottom: 1px solid #E5E5E5; vertical-align: top; overflow-wrap: break-word; }
  tr { break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #FAFAFA; }
  .numeric { text-align: right; }
  td.numeric, td.date { white-space: nowrap; }
  .secondary { display: block; font-size: 8px; color: #64748B; overflow-wrap: anywhere; }
  .secondary-inline { color: #64748B; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 999px; font-weight: 700; white-space: nowrap; }
  .badge-completed { background: #E6FBF5; color: #116B51; }
  .badge-inProgress { background: #FFFCC2; color: #88510B; }
  .badge-notStarted { background: #EDEDED; color: #545454; }
  .progress { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
  .progress .bar { width: 40px; }
  .certificate-active { font-weight: 700; color: #116B51; }
  .path-courses { margin: 0; padding-left: 12px; }
`;
