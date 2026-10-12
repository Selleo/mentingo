import { match } from "ts-pattern";

import {
  REPORT_EXPORT_COLORS,
  REPORT_EXPORT_EMPTY_VALUE,
  REPORT_EXPORT_DATE_DISPLAY_LENGTH,
  REPORT_EXPORT_LIST_MARKER,
  REPORT_EXPORT_RECORDS_COLUMN_FIT,
  REPORT_EXPORT_RIGHT_ALIGNED_COLUMNS,
  REPORT_EXPORT_STRONG_RESULT_PERCENT,
  REPORT_EXPORT_SUMMARY_CARD_COLUMNS,
  REPORT_EXPORT_SUMMARY_CONTENT_SPAN,
  REPORT_EXPORT_SUMMARY_RULE_COLUMNS,
  REPORT_EXPORT_SUMMARY_SPACER_HEIGHT,
  REPORT_EXPORT_ACTIVITY_METRICS,
  REPORT_EXPORT_PERFORMANCE_METRICS,
  REPORT_EXPORT_SUMMARY_COLUMN_WIDTHS,
  REPORT_EXPORT_XLSX_FORMATS as FORMAT,
} from "../constants/reports-exports.constants";
import { REPORT_STATUS } from "../constants/reports.constants";

import { formatPercent } from "./reports-export.utils";

import type {
  ReportExportColumn,
  ReportExportDocument,
  ReportExportMetric,
  ReportExportRow,
} from "../reports-exports.types";
import type { Cell, Columns, Row, SheetData } from "write-excel-file";

/**
 * The summary sheet, laid out as a dashboard: a title banner, six performance cards,
 * the learning activity table and, last, the filters the report was run with.
 */
export function buildSummarySheet(document: ReportExportDocument): SheetData {
  return [
    gridRow([[0, textCell("", { height: REPORT_EXPORT_SUMMARY_SPACER_HEIGHT })]]),
    ...buildBanner(document),
    [],
    sectionCaption(document.labels.performanceOverview),
    ...buildPerformanceCards(REPORT_EXPORT_PERFORMANCE_METRICS.map((key) => document.metrics[key])),
    [],
    sectionHeading(document.labels.learningActivity),
    ...REPORT_EXPORT_ACTIVITY_METRICS.map((key) => buildActivityRow(document.metrics[key])),
    [],
    sectionHeading(document.labels.reportFilters),
    ...buildFilters(document),
  ];
}

function buildBanner(document: ReportExportDocument): SheetData {
  const bannerStyle = {
    backgroundColor: REPORT_EXPORT_COLORS.primaryDark,
    color: REPORT_EXPORT_COLORS.white,
    span: REPORT_EXPORT_SUMMARY_CONTENT_SPAN,
  };

  return [
    gridRow([
      [
        1,
        textCell(document.title, {
          ...bannerStyle,
          fontSize: 18,
          fontWeight: "bold",
          height: 36,
          alignVertical: "bottom",
        }),
      ],
    ]),
    gridRow([
      [
        1,
        textCell(document.generatedAt, {
          ...bannerStyle,
          height: 24,
          alignVertical: "top",
        }),
      ],
    ]),
  ];
}

/** Two rows of three cards: a small label above a large value. */
function buildPerformanceCards(metrics: ReportExportMetric[]): SheetData {
  const cardStyle = { backgroundColor: REPORT_EXPORT_COLORS.card, span: 2 };
  const rowsOfCards = [metrics.slice(0, 3), metrics.slice(3, 6)];

  return rowsOfCards.flatMap((cards, index) => [
    ...(index > 0 ? [[]] : []),
    gridRow(
      cards.map((metric, column) => [
        REPORT_EXPORT_SUMMARY_CARD_COLUMNS[column],
        textCell(metric.label, {
          ...cardStyle,
          color: REPORT_EXPORT_COLORS.muted,
          fontSize: 9,
          height: 22,
          alignVertical: "bottom",
          indent: 1,
        }),
      ]),
    ),
    gridRow(
      cards.map((metric, column) => [
        REPORT_EXPORT_SUMMARY_CARD_COLUMNS[column],
        metricCell(metric, {
          ...cardStyle,
          fontSize: 20,
          fontWeight: "bold",
          height: 36,
          alignVertical: "top",
          align: "left",
          indent: 1,
        }),
      ]),
    ),
  ]);
}

/** A label and its value on one line, divided from the next line by a thin rule. */
function buildActivityRow(metric: ReportExportMetric): Row {
  const ruleStyle = {
    bottomBorderColor: REPORT_EXPORT_COLORS.border,
    bottomBorderStyle: "thin" as const,
    height: 24,
    alignVertical: "center" as const,
  };
  const ruleCells = REPORT_EXPORT_SUMMARY_RULE_COLUMNS.map((column): [number, Cell] => [
    column,
    textCell("", ruleStyle),
  ]);

  return gridRow([
    [1, textCell(metric.label, ruleStyle)],
    ...ruleCells,
    [8, metricCell(metric, { ...ruleStyle, align: "right" })],
  ]);
}

function buildFilters(document: ReportExportDocument): SheetData {
  const [first, second] = document.filters;
  const firstSpan = second ? 3 : REPORT_EXPORT_SUMMARY_CONTENT_SPAN;
  const labelStyle = {
    color: REPORT_EXPORT_COLORS.muted,
    fontSize: 9,
    height: 22,
    alignVertical: "bottom" as const,
  };
  const valueStyle = {
    fontWeight: "bold" as const,
    fontSize: 12,
    height: 22,
    alignVertical: "top" as const,
  };
  const { conditions } = document;
  const hasConditions = conditions.lines[0] !== document.labels.noConditions;

  return [
    gridRow([
      [1, textCell(first.label, { ...labelStyle, span: firstSpan })],
      ...(second
        ? [[4, textCell(second.label, { ...labelStyle, span: 5 })] as [number, Cell]]
        : []),
    ]),
    gridRow([
      [1, textCell(first.value, { ...valueStyle, span: firstSpan })],
      ...(second
        ? [[4, textCell(second.value, { ...valueStyle, span: 5 })] as [number, Cell]]
        : []),
    ]),
    [],
    sectionCaption(conditions.heading.toLocaleUpperCase(document.language)),
    ...conditions.lines.map((line) =>
      gridRow([
        [
          1,
          textCell(hasConditions ? `${REPORT_EXPORT_LIST_MARKER} ${line}` : line, {
            span: REPORT_EXPORT_SUMMARY_CONTENT_SPAN,
            height: 22,
            wrap: true,
            alignVertical: "center",
          }),
        ],
      ]),
    ),
  ];
}

function sectionHeading(value: string): Row {
  return gridRow([
    [
      1,
      textCell(value, {
        span: REPORT_EXPORT_SUMMARY_CONTENT_SPAN,
        fontSize: 12,
        fontWeight: "bold",
        color: REPORT_EXPORT_COLORS.primaryDark,
        backgroundColor: REPORT_EXPORT_COLORS.primaryLight,
        height: 26,
        alignVertical: "center",
        indent: 1,
      }),
    ],
  ]);
}

function sectionCaption(value: string): Row {
  return gridRow([
    [
      1,
      textCell(value.toUpperCase(), {
        span: REPORT_EXPORT_SUMMARY_CONTENT_SPAN,
        fontSize: 9,
        fontWeight: "bold",
        color: REPORT_EXPORT_COLORS.muted,
        height: 20,
        alignVertical: "bottom",
      }),
    ],
  ]);
}

/** One summary row on the dashboard grid; cells covered by a span stay empty. */
function gridRow(cells: Array<[number, Cell]>): Row {
  const row: Row = REPORT_EXPORT_SUMMARY_COLUMN_WIDTHS.map(() => null);
  for (const [column, cell] of cells) row[column] = cell;
  return row;
}

export function getSummarySheetColumns(): Columns {
  return REPORT_EXPORT_SUMMARY_COLUMN_WIDTHS.map((width) => ({ width }));
}

/** The records sheet: one typed row per learning record, ready to sort and filter. */
export function buildRecordsSheet(document: ReportExportDocument): SheetData {
  const header = document.columns.map(recordsHeaderCell);
  const rows = document.rows.map((row, index) =>
    document.columns.map((column) => recordCell(column, row, index % 2 === 1)),
  );

  return [header, ...rows];
}

/** A light header in the style of reporting-tool exports, aligned like the values below it. */
function recordsHeaderCell(column: ReportExportColumn): Cell {
  return textCell(column.label, {
    fontWeight: "bold",
    color: REPORT_EXPORT_COLORS.primaryDark,
    backgroundColor: REPORT_EXPORT_COLORS.primaryLight,
    bottomBorderColor: REPORT_EXPORT_COLORS.primary,
    bottomBorderStyle: "medium",
    height: 28,
    alignVertical: "center",
    align: REPORT_EXPORT_RIGHT_ALIGNED_COLUMNS.has(column.key) ? "right" : "left",
    indent: 1,
  });
}

/** Sizes each column to its longest value within the cap, keeping room for the whole label. */
export function getRecordsSheetColumns(document: ReportExportDocument): Columns {
  const { min, max, padding, headerScale } = REPORT_EXPORT_RECORDS_COLUMN_FIT;

  return document.columns.map((column) => {
    const labelWidth = Math.ceil(column.label.length * headerScale) + padding;
    const longestValue = Math.max(
      0,
      ...document.rows.map((row) => recordDisplayLength(column, row)),
    );
    const valueWidth = Math.min(longestValue + padding, max);

    return { width: Math.max(min, labelWidth, valueWidth) };
  });
}

/** Roughly how many characters a record's value takes once shown in the sheet. */
function recordDisplayLength(column: ReportExportColumn, row: ReportExportRow): number {
  const dateLength = (value: Date | null) =>
    value ? REPORT_EXPORT_DATE_DISPLAY_LENGTH : REPORT_EXPORT_EMPTY_VALUE.length;

  return match(column.key)
    .with("learner", () => row.learnerName.length)
    .with("email", () => row.learnerEmail.length)
    .with("course", () => (row.course ?? REPORT_EXPORT_EMPTY_VALUE).length)
    .with("path", () => (row.path ?? REPORT_EXPORT_EMPTY_VALUE).length)
    .with("status", () => row.statusLabel.length)
    .with("progress", () => formatPercent(row.progress).length)
    .with("score", () => formatPercent(row.score).length)
    .with("attempts", () => String(row.attempts).length)
    .with("certificate", () => row.certificateLabel.length)
    .with("certificateIssuedAt", () => dateLength(row.certificateIssuedAt))
    .with("enrolledAt", () => dateLength(row.enrolledAt))
    .with("completedAt", () => dateLength(row.completedAt))
    .with("lastActivityAt", () => dateLength(row.lastActivityAt))
    .with("pathCourses", () => Math.max(0, ...row.pathCourses.map((course) => course.length)))
    .exhaustive();
}

/** A record cell divided from the next record by a thin rule; every other row is lightly shaded. */
function recordCell(column: ReportExportColumn, row: ReportExportRow, isStriped: boolean): Cell {
  const rowStyle = {
    alignVertical: "center" as const,
    indent: 1,
    bottomBorderColor: REPORT_EXPORT_COLORS.border,
    bottomBorderStyle: "thin" as const,
    ...(isStriped ? { backgroundColor: REPORT_EXPORT_COLORS.rowStripe } : {}),
  };
  const wrappingStyle = { ...rowStyle, wrap: true };

  return match(column.key)
    .with("learner", () => textCell(row.learnerName, wrappingStyle))
    .with("email", () => textCell(row.learnerEmail, wrappingStyle))
    .with("course", () => textCell(row.course ?? REPORT_EXPORT_EMPTY_VALUE, wrappingStyle))
    .with("path", () => textCell(row.path ?? REPORT_EXPORT_EMPTY_VALUE, wrappingStyle))
    .with("status", () => textCell(row.statusLabel, { ...rowStyle, ...statusStyle(row.status) }))
    .with("progress", () => percentCell(row.progress, rowStyle))
    .with("score", () => percentCell(row.score, rowStyle))
    .with("attempts", () => ({
      value: row.attempts,
      type: Number,
      format: FORMAT.count,
      ...rowStyle,
    }))
    .with("certificate", () => textCell(row.certificateLabel, rowStyle))
    .with("certificateIssuedAt", () => dateCell(row.certificateIssuedAt, rowStyle))
    .with("enrolledAt", () => dateCell(row.enrolledAt, rowStyle))
    .with("completedAt", () => dateCell(row.completedAt, rowStyle))
    .with("lastActivityAt", () => dateCell(row.lastActivityAt, rowStyle))
    .with("pathCourses", () => textCell(row.pathCourses.join("\n"), wrappingStyle))
    .exhaustive();
}

function statusStyle(status: ReportExportRow["status"]) {
  return match(status)
    .with(REPORT_STATUS.COMPLETED, () => ({ color: REPORT_EXPORT_COLORS.success }))
    .with(REPORT_STATUS.IN_PROGRESS, () => ({ color: REPORT_EXPORT_COLORS.warning }))
    .otherwise(() => ({ color: REPORT_EXPORT_COLORS.muted }));
}

/** A metric value; strong percentages are shown in green. */
function metricCell(metric: ReportExportMetric, style: Partial<NonNullable<Cell>> = {}): Cell {
  if (metric.value === null) return textCell(REPORT_EXPORT_EMPTY_VALUE, style);
  if (metric.unit === "count") {
    return { value: metric.value, type: Number, format: FORMAT.count, ...style };
  }

  const isStrong = metric.value >= REPORT_EXPORT_STRONG_RESULT_PERCENT;
  return percentCell(metric.value, {
    ...style,
    ...(isStrong ? { color: REPORT_EXPORT_COLORS.success } : {}),
  });
}

function percentCell(value: number | null, style: Partial<NonNullable<Cell>> = {}): Cell {
  if (value === null) return textCell(REPORT_EXPORT_EMPTY_VALUE, { align: "right", ...style });
  return { value: value / 100, type: Number, format: FORMAT.percent, ...style };
}

function dateCell(value: Date | null, style: Partial<NonNullable<Cell>> = {}): Cell {
  if (!value) return textCell(REPORT_EXPORT_EMPTY_VALUE, { ...style, align: "right" });
  return { value, type: Date, format: FORMAT.date, ...style };
}

function textCell(value: string, style: Partial<NonNullable<Cell>> = {}): Cell {
  return { value: neutralizeFormula(value), type: String, ...style };
}

/**
 * Prefixes text that a spreadsheet would otherwise run as a formula. A dash on its own
 * or followed by a space (the empty-value and list markers) cannot start a formula.
 */
function neutralizeFormula(value: string): string {
  return /^[\s\u0000-\u001f]*([=+@]|-(?=\S))/.test(value) ? `'${value}` : value;
}
