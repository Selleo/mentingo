import { match } from "ts-pattern";

import {
  REPORT_EXPORT_PDF_COLUMN_WIDTHS,
  REPORT_EXPORT_PDF_ICONS,
  REPORT_EXPORT_PDF_METRIC_ICONS,
  REPORT_EXPORT_PDF_NUMERIC_COLUMNS,
  REPORT_EXPORT_PDF_OMITTED_COLUMNS,
  REPORT_EXPORT_PDF_STYLES,
} from "../constants/reports-export-pdf.constants";
import {
  REPORT_EXPORT_ACTIVITY_METRICS,
  REPORT_EXPORT_EMPTY_VALUE,
  REPORT_EXPORT_LIST_MARKER,
  REPORT_EXPORT_PERFORMANCE_METRICS,
  REPORT_EXPORT_STRONG_RESULT_PERCENT,
} from "../constants/reports-exports.constants";
import { REPORT_CERTIFICATE_STATUS } from "../constants/reports.constants";

import { formatExportDay, formatPercent } from "./reports-export.utils";

import type { ReportExportPdfIcon } from "../constants/reports-export-pdf.constants";
import type {
  ReportExportColumn,
  ReportExportDocument,
  ReportExportMetric,
  ReportExportRow,
} from "../reports-exports.types";

/**
 * The PDF report as one HTML page, in the same order as the spreadsheet summary:
 * performance overview with learning activity, the report filters, then every record.
 */
export function buildReportExportHtml(document: ReportExportDocument): string {
  return `<!doctype html>
<html lang="${escapeHtml(document.language)}">
  <head>
    <meta charset="utf-8">
    <style>${REPORT_EXPORT_PDF_STYLES}</style>
  </head>
  <body>
    ${renderHeader(document)}
    ${renderOverview(document)}
    ${renderFilters(document)}
    ${renderRecords(document)}
  </body>
</html>`;
}

/** Footer printed on every PDF page by the browser, with the page number. */
export function buildReportExportFooter(document: ReportExportDocument): string {
  return `<div style="width:100%;padding:0 12mm;font:8px Arial,sans-serif;color:#999999;display:flex;justify-content:space-between">
    <span>${escapeHtml(document.title)} · ${escapeHtml(document.generatedAt)}</span>
    <span>${escapeHtml(
      document.labels.page,
    )} <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

function renderHeader(document: ReportExportDocument): string {
  return `<header class="page-header">
    <h1>${escapeHtml(document.title)}</h1>
    <p>${escapeHtml(document.generatedAt)}</p>
  </header>`;
}

/** Six performance cards beside the learning activity list, as on the summary sheet. */
function renderOverview(document: ReportExportDocument): string {
  const tiles = REPORT_EXPORT_PERFORMANCE_METRICS.map((key) => {
    const metric = document.metrics[key];
    const iconName = REPORT_EXPORT_PDF_METRIC_ICONS[key];
    return `<div class="card">
      <span class="tile-label">${iconName ? icon(iconName) : ""}${escapeHtml(metric.label)}</span>
      <span class="${tileValueClass(metric)}">${escapeHtml(formatMetric(metric))}</span>
    </div>`;
  }).join("");
  const activity = REPORT_EXPORT_ACTIVITY_METRICS.map((key) => {
    const metric = document.metrics[key];
    return `<div class="activity-row">
      <span>${escapeHtml(metric.label)}</span>
      <strong>${escapeHtml(formatMetric(metric))}</strong>
    </div>`;
  }).join("");

  return `<section>
    <p class="caption">${escapeHtml(document.labels.performanceOverview)}</p>
    <div class="overview">
      <div class="tiles">${tiles}</div>
      <div class="card">
        <h2 class="card-title">${escapeHtml(document.labels.learningActivity)}</h2>
        ${activity}
      </div>
    </div>
  </section>`;
}

/** The filters the report was run with, laid out like the spreadsheet's report filters. */
function renderFilters(document: ReportExportDocument): string {
  const { conditions, labels } = document;
  const hasConditions = conditions.lines[0] !== labels.noConditions;
  const filters = document.filters
    .map(
      ({ label, value }) => `<div>
        <span class="filter-label">${escapeHtml(label)}</span>
        <span class="filter-value">${escapeHtml(value)}</span>
      </div>`,
    )
    .join("");
  const lines = conditions.lines
    .map((line) => {
      const text = hasConditions ? `${REPORT_EXPORT_LIST_MARKER} ${line}` : line;
      return `<li>${escapeHtml(text)}</li>`;
    })
    .join("");

  return `<section class="card">
    <h2 class="card-title">${icon("filters")}${escapeHtml(labels.reportFilters)}</h2>
    <div class="filters">${filters}</div>
    <p class="caption">${escapeHtml(conditions.heading)}</p>
    <ul class="conditions">${lines}</ul>
  </section>`;
}

function renderRecords(document: ReportExportDocument): string {
  const columns = document.columns.filter(({ key }) => !REPORT_EXPORT_PDF_OMITTED_COLUMNS.has(key));
  const header = columns
    .map((column) => `<th class="${columnClass(column)}">${escapeHtml(column.label)}</th>`)
    .join("");
  const rows = document.rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (column) =>
              `<td class="${columnClass(column)}">${renderCell(
                column,
                row,
                document.language,
              )}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  return `<section>
    <div class="records-header">
      <h2 class="card-title">${icon("table")}${escapeHtml(document.labels.recordsSheet)}</h2>
      <span>${escapeHtml(document.recordCount)}</span>
    </div>
    <table>
      ${renderColumnWidths(columns)}
      <thead><tr>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

/** Shares the page width between the shown columns in proportion to their configured widths. */
function renderColumnWidths(columns: ReportExportColumn[]): string {
  const total = columns.reduce((sum, { key }) => sum + REPORT_EXPORT_PDF_COLUMN_WIDTHS[key], 0);
  const cols = columns
    .map(
      ({ key }) => `<col style="width:${(REPORT_EXPORT_PDF_COLUMN_WIDTHS[key] / total) * 100}%">`,
    )
    .join("");

  return `<colgroup>${cols}</colgroup>`;
}

function renderCell(column: ReportExportColumn, row: ReportExportRow, language: string): string {
  return match(column.key)
    .with(
      "learner",
      () =>
        `<span class="learner-name">${escapeHtml(
          row.learnerName,
        )}</span><span class="secondary">${escapeHtml(row.learnerEmail)}</span>`,
    )
    .with("email", () => escapeHtml(row.learnerEmail))
    .with("course", () => escapeHtml(row.course ?? REPORT_EXPORT_EMPTY_VALUE))
    .with("path", () => escapeHtml(row.path ?? REPORT_EXPORT_EMPTY_VALUE))
    .with(
      "status",
      () => `<span class="badge badge-${row.status}">${escapeHtml(row.statusLabel)}</span>`,
    )
    .with(
      "progress",
      () =>
        `<span class="progress">${renderBar(row.progress)}${formatPercent(row.progress)}</span>`,
    )
    .with("score", () => formatPercent(row.score))
    .with("attempts", () => String(row.attempts))
    .with(
      "certificate",
      () =>
        `<span class="${certificateClass(row.certificateStatus)}">${escapeHtml(
          row.certificateLabel,
        )}</span>`,
    )
    .with("certificateIssuedAt", () => formatExportDay(row.certificateIssuedAt, language))
    .with("enrolledAt", () => formatExportDay(row.enrolledAt, language))
    .with("completedAt", () => formatExportDay(row.completedAt, language))
    .with("lastActivityAt", () => formatExportDay(row.lastActivityAt, language))
    .with(
      "pathCourses",
      () =>
        `<ul class="path-courses">${row.pathCourses
          .map((course) => `<li>${escapeHtml(course)}</li>`)
          .join("")}</ul>`,
    )
    .exhaustive();
}

function renderBar(value: number | null): string {
  return `<span class="bar"><span style="width:${clampPercent(value)}%"></span></span>`;
}

function icon(name: ReportExportPdfIcon): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${REPORT_EXPORT_PDF_ICONS[name]}</svg>`;
}

/** Strong percentages are shown in green, as on the summary sheet. */
function tileValueClass(metric: ReportExportMetric): string {
  const isStrong =
    metric.unit === "percent" &&
    metric.value !== null &&
    metric.value >= REPORT_EXPORT_STRONG_RESULT_PERCENT;
  return isStrong ? "tile-value tile-value-strong" : "tile-value";
}

function formatMetric(metric: ReportExportMetric): string {
  return metric.unit === "percent"
    ? formatPercent(metric.value)
    : String(metric.value ?? REPORT_EXPORT_EMPTY_VALUE);
}

function clampPercent(value: number | null): number {
  return Math.max(0, Math.min(100, value ?? 0));
}

function columnClass(column: ReportExportColumn): string {
  if (REPORT_EXPORT_PDF_NUMERIC_COLUMNS.has(column.key)) return "numeric";

  return match(column.key)
    .with("enrolledAt", "completedAt", "lastActivityAt", "certificateIssuedAt", () => "date")
    .otherwise(() => "");
}

function certificateClass(status: ReportExportRow["certificateStatus"]): string {
  return status === REPORT_CERTIFICATE_STATUS.ACTIVE ? "certificate-active" : "muted";
}

function escapeHtml(value: unknown): string {
  return String(value ?? REPORT_EXPORT_EMPTY_VALUE).replace(/[&<>"']/g, (character) =>
    match(character)
      .with("&", () => "&amp;")
      .with("<", () => "&lt;")
      .with(">", () => "&gt;")
      .with('"', () => "&quot;")
      .otherwise(() => "&#39;"),
  );
}
