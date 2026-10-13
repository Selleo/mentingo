import type { ReportExportColumnKey, ReportExportMetricKey } from "../reports-exports.types";

/** Columns the PDF leaves out to fit an A4 page; the email sits under the learner's name instead. */
export const REPORT_EXPORT_PDF_OMITTED_COLUMNS = new Set<ReportExportColumnKey>([
  "email",
  "certificateIssuedAt",
]);

/** PDF table column widths, as a share of the page width. */
export const REPORT_EXPORT_PDF_COLUMN_WIDTHS: Record<ReportExportColumnKey, number> = {
  learner: 18,
  email: 0,
  course: 16,
  path: 9,
  status: 9,
  progress: 10,
  score: 6,
  attempts: 6,
  certificate: 8,
  certificateIssuedAt: 0,
  enrolledAt: 9,
  completedAt: 9,
  lastActivityAt: 9,
  pathCourses: 22,
};

export const REPORT_EXPORT_PDF_NUMERIC_COLUMNS = new Set<ReportExportColumnKey>([
  "progress",
  "score",
  "attempts",
]);

export const REPORT_EXPORT_PDF_ICONS = {
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><path d="M16 3.128a4 4 0 0 1 0 7.744"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  circleCheck: '<path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/>',
  activity:
    '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  trendingUp: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  clipboardCheck:
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  award:
    '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  table:
    '<path d="M15 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M21 9H3"/><path d="M21 15H3"/>',
  filters:
    '<path d="M10 5H3"/><path d="M12 19H3"/><path d="M14 3v4"/><path d="M16 17v4"/><path d="M21 12h-9"/><path d="M21 19h-5"/><path d="M21 5h-7"/><path d="M8 10v4"/><path d="M8 12H3"/>',
} as const;

export type ReportExportPdfIcon = keyof typeof REPORT_EXPORT_PDF_ICONS;

export const REPORT_EXPORT_PDF_METRIC_ICONS: Partial<
  Record<ReportExportMetricKey, ReportExportPdfIcon>
> = {
  learners: "users",
  courseCompletionRate: "circleCheck",
  averageProgress: "trendingUp",
  averageScore: "clipboardCheck",
  certificatesIssued: "award",
  activeLearners30d: "activity",
};

export const REPORT_EXPORT_PDF_STYLES = `
  * { box-sizing: border-box; }
  body { margin: 0; font: 9.5px/1.45 "Helvetica Neue", Arial, "Liberation Sans", sans-serif; color: #363636; }
  section { margin-top: 14px; }
  .page-header h1 { margin: 0; font-size: 22px; font-weight: 600; color: #363636; }
  .page-header p { margin: 2px 0 0; color: #888888; }
  .caption { margin: 0 0 6px; font-size: 8px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #888888; }
  .icon { width: 12px; height: 12px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .card { padding: 12px 14px; border: 1px solid #E5E5E5; border-radius: 8px; background: #FFFFFF; break-inside: avoid; }
  .card-title { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 11px; font-weight: 600; color: #363636; }
  .card-title .icon { color: #999999; }
  .overview { display: grid; grid-template-columns: 2fr 1fr; gap: 10px; break-inside: avoid; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile-label { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 500; color: #888888; }
  .tile-value { display: block; margin-top: 4px; font-size: 22px; font-weight: 600; line-height: 1.3; color: #363636; }
  .tile-value-strong { color: #116B51; }
  .activity-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #EDEDED; }
  .activity-row:last-child { border-bottom: none; }
  .activity-row strong { font-weight: 600; }
  .filters { display: flex; gap: 48px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px solid #EDEDED; }
  .filter-label { display: block; font-size: 8.5px; color: #888888; }
  .filter-value { font-size: 11px; font-weight: 600; }
  .conditions { margin: 0; padding: 0; list-style: none; }
  .conditions li { padding: 2px 0; }
  .records-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
  .records-header .card-title { margin: 0; }
  .records-header span { color: #999999; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  th { padding: 7px 8px; border-top: 1px solid #E5E5E5; border-bottom: 1px solid #E5E5E5; background: #F7F7F7; text-align: left; font-size: 8.5px; font-weight: 500; color: #888888; }
  td { padding: 7px 8px; border-bottom: 1px solid #EDEDED; vertical-align: middle; overflow-wrap: break-word; }
  tr { break-inside: avoid; }
  .numeric { text-align: right; }
  td.numeric, td.date { white-space: nowrap; }
  .learner-name { font-weight: 500; color: #363636; }
  .secondary { display: block; font-size: 8px; color: #999999; overflow-wrap: anywhere; }
  .muted { color: #999999; }
  .badge { display: inline-block; padding: 2px 7px; border-radius: 6px; font-size: 8.5px; font-weight: 500; white-space: nowrap; }
  .badge-completed { background: #E6FBF5; color: #0E4637; }
  .badge-inProgress { background: #FFFCC2; color: #88510B; }
  .badge-notStarted { background: #EDEDED; color: #888888; }
  .bar { display: block; height: 5px; border-radius: 3px; background: #EDEDED; overflow: hidden; }
  .bar span { display: block; height: 100%; border-radius: 3px; background: #4F6FC9; }
  .progress { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
  .progress .bar { width: 40px; }
  .certificate-active { font-weight: 500; color: #116B51; }
  .path-courses { margin: 0; padding-left: 12px; }
`;
