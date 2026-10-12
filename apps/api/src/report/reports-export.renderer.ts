import { Readable } from "node:stream";

import { Injectable } from "@nestjs/common";
import puppeteer from "puppeteer";
import { match } from "ts-pattern";
import writeXlsxFile from "write-excel-file/node";

import { REPORT_EXPORT_FORMAT } from "./constants/reports.constants";
import { buildReportExportFooter, buildReportExportHtml } from "./utils/reports-export-pdf.utils";
import {
  buildRecordsSheet,
  buildSummarySheet,
  getRecordsSheetColumns,
  getSummarySheetColumns,
} from "./utils/reports-export-xlsx.utils";
import { buildReportExportDocument } from "./utils/reports-export.utils";

import type {
  ReportExportDocument,
  ReportExportFormat,
  ReportExportScope,
} from "./reports-exports.types";
import type { ReportsQuery, ReportsResult } from "./schemas/reports.schema";

@Injectable()
export class ReportsExportRenderer {
  async render(
    format: ReportExportFormat,
    result: ReportsResult,
    query: ReportsQuery,
    generatedAt: Date,
    scope: ReportExportScope = {
      groups: query.groupIds,
      subject: query.subjectId ?? null,
      recordLabels: {},
    },
  ): Promise<Readable> {
    const document = buildReportExportDocument(result, query, generatedAt, scope);

    return match(format)
      .with(REPORT_EXPORT_FORMAT.XLSX, () => this.renderSpreadsheet(document))
      .otherwise(() => this.renderPdf(document));
  }

  private async renderSpreadsheet(document: ReportExportDocument): Promise<Readable> {
    return writeXlsxFile([buildSummarySheet(document), buildRecordsSheet(document)], {
      sheets: [document.labels.summarySheet, document.labels.recordsSheet],
      columns: [getSummarySheetColumns(), getRecordsSheetColumns(document)],
      fontFamily: "Calibri",
      fontSize: 11,
      // Freezes the records header. The summary starts with a spacer row so nothing visible is frozen there.
      stickyRowsCount: 1,
      showGridLines: false,
    });
  }

  private async renderPdf(document: ReportExportDocument): Promise<Readable> {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    });
    return this.createPdfStream(browser, document);
  }

  private async createPdfStream(
    browser: Awaited<ReturnType<typeof puppeteer.launch>>,
    document: ReportExportDocument,
  ): Promise<Readable> {
    try {
      const page = await browser.newPage();
      await page.setContent(buildReportExportHtml(document), { waitUntil: "load" });
      const browserStream = await page.createPDFStream({
        format: "A4",
        landscape: true,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: "<span></span>",
        footerTemplate: buildReportExportFooter(document),
        margin: { top: "12mm", right: "12mm", bottom: "16mm", left: "12mm" },
      });
      const pdfStream = Readable.fromWeb(
        browserStream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
      );
      let closePromise: Promise<void> | undefined;
      const closeBrowser = () => {
        closePromise ??= browser.close();
        return closePromise;
      };
      pdfStream.once("end", () => {
        void closeBrowser();
      });
      pdfStream.once("error", () => {
        void closeBrowser();
      });
      pdfStream.once("close", () => {
        void closeBrowser();
      });
      return pdfStream;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }
}
