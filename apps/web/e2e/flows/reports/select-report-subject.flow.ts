import { applyReportFlow } from "./apply-report.flow";
import { chooseReportOptionFlow } from "./choose-report-option.flow";

import type { Page } from "@playwright/test";

type SelectReportSubjectFlowInput = {
  tab: RegExp;
  subjectLabel: string;
  subjectName: string;
};

/** Switches to a report tab, picks its subject and applies the report. */
export const selectReportSubjectFlow = async (
  page: Page,
  { tab, subjectLabel, subjectName }: SelectReportSubjectFlowInput,
) => {
  await page.getByRole("tab", { name: tab }).click();
  await chooseReportOptionFlow(
    page,
    page.getByRole("combobox", { name: subjectLabel }),
    subjectName,
  );
  await applyReportFlow(page);
};
