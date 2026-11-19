import { REPORTS_HANDLES } from "../../data/reports/handles";

import { applyReportFlow } from "./apply-report.flow";
import { chooseReportOptionFlow } from "./choose-report-option.flow";

import type { Page } from "@playwright/test";
import type { ReportView } from "~/modules/Reports/reports.types";

type SelectReportSubjectFlowInput = {
  view: ReportView;
  subjectId: string;
  search?: string;
};

/** Switches to a report tab, picks its subject and applies the report. */
export const selectReportSubjectFlow = async (
  page: Page,
  { view, subjectId, search }: SelectReportSubjectFlowInput,
) => {
  await page.getByTestId(REPORTS_HANDLES.viewTab(view)).click();
  await chooseReportOptionFlow(
    page,
    page.getByTestId(REPORTS_HANDLES.SUBJECT_PICKER),
    REPORTS_HANDLES.option(subjectId),
    search,
  );
  await applyReportFlow(page);
};
