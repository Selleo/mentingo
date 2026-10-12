import { match } from "ts-pattern";

import {
  REPORT_EXPORT_EMPTY_VALUE,
  REPORT_EXPORT_PDF_COLUMN_WIDTHS,
  REPORT_EXPORT_PDF_OMITTED_COLUMNS,
  REPORT_EXPORT_PDF_STYLES,
  REPORT_EXPORT_STRONG_RESULT_PERCENT,
} from "../constants/reports-exports.constants";
import { REPORT_CERTIFICATE_STATUS } from "../constants/reports.constants";

import { formatExportDay, formatPercent } from "./reports-export.utils";

import type {
  ReportExportColumn,
  ReportExportDocument,
  ReportExportMetric,
  ReportExportRow,
} from "../reports-exports.types";

/**
 * The PDF report as one HTML page: header, performance overview, learning activity,
 * the filters the report was run with, then the records table.
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
    ${renderPerformance(document)}
    ${renderActivity(document)}
    ${renderFilters(document)}
    ${renderRecords(document)}
  </body>
</html>`;
}

/** Footer printed on every PDF page by the browser, with the page number. */
export function buildReportExportFooter(document: ReportExportDocument): string {
  return `<div style="width:100%;padding:0 12mm;font:8px Arial,sans-serif;color:#64748b;display:flex;justify-content:space-between">
    <span>${escapeHtml(document.title)} · ${escapeHtml(document.subtitle)}</span>
    <span>${escapeHtml(
      document.labels.page,
    )} <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

function renderHeader(document: ReportExportDocument): string {
  return `<header class="header">
    <div>
      <h1>${escapeHtml(document.title)}</h1>
      <p>${escapeHtml(document.subtitle)} | ${escapeHtml(document.generatedAt)}</p>
    </div>
  </header>`;
}

function renderPerformance(document: ReportExportDocument): string {
  const cards = document.performance
    .map(
      (metric) => `<div class="metric">
        <span class="metric-label">${escapeHtml(metric.label)}</span>
        <span class="${metricValueClass(metric)}">${escapeHtml(formatMetric(metric))}</span>
      </div>`,
    )
    .join("");

  return `<section>
    <p class="caption">${escapeHtml(document.labels.performanceOverview)}</p>
    <div class="metrics">${cards}</div>
  </section>`;
}

function renderActivity(document: ReportExportDocument): string {
  const rows = document.activity
    .map(
      (metric) => `<div class="metric-row">
        <span>${escapeHtml(metric.label)}</span>
        <strong>${escapeHtml(formatMetric(metric))}</strong>
      </div>`,
    )
    .join("");

  return `<section class="panel">
    <h2>${escapeHtml(document.labels.learningActivity)}</h2>
    <div class="metric-list">${rows}</div>
  </section>`;
}

function renderFilters(document: ReportExportDocument): string {
  const { conditions, labels } = document;
  const hasConditions = conditions.lines[0] !== labels.noConditions;
  const filters = document.filters
    .map(
      ({ label, value }) => `<div class="filter">
        <span class="filter-label">${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>`,
    )
    .join("");
  const lines = conditions.lines
    .map((line) => `<li class="${hasConditions ? "condition" : ""}">${escapeHtml(line)}</li>`)
    .join("");

  return `<section class="panel">
    <h2>${escapeHtml(labels.reportFilters)}</h2>
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
    <div class="section-heading">
      <h2>${escapeHtml(document.labels.recordsSheet)}</h2>
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
        `<strong>${escapeHtml(row.learnerName)}</strong><span class="secondary">${escapeHtml(
          row.learnerEmail,
        )}</span>`,
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
  const width = Math.max(0, Math.min(100, value ?? 0));
  return `<span class="bar"><span style="width:${width}%"></span></span>`;
}

function metricValueClass(metric: ReportExportMetric): string {
  const isStrong =
    metric.unit === "percent" &&
    metric.value !== null &&
    metric.value >= REPORT_EXPORT_STRONG_RESULT_PERCENT;
  return isStrong ? "metric-value metric-value-strong" : "metric-value";
}

function formatMetric(metric: ReportExportMetric): string {
  return metric.unit === "percent"
    ? formatPercent(metric.value)
    : String(metric.value ?? REPORT_EXPORT_EMPTY_VALUE);
}

function columnClass(column: ReportExportColumn): string {
  return match(column.key)
    .with("progress", "score", "attempts", () => "numeric")
    .with("enrolledAt", "completedAt", "lastActivityAt", "certificateIssuedAt", () => "date")
    .otherwise(() => "");
}

function certificateClass(status: ReportExportRow["certificateStatus"]): string {
  return status === REPORT_CERTIFICATE_STATUS.ACTIVE ? "certificate-active" : "secondary-inline";
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
