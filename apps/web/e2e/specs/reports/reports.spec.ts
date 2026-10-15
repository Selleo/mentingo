import { USER_ROLE } from "~/config/userRoles";

import { REPORTS_HANDLES } from "../../data/reports/handles";
import { REPORTS_IDS, REPORTS_INACCESSIBLE_CONFIGURATION } from "../../data/reports/reports.data";
import { expect, test } from "../../fixtures/test.fixture";
import { applyReportFlow } from "../../flows/reports/apply-report.flow";
import { chooseReportOptionFlow } from "../../flows/reports/choose-report-option.flow";
import { exportReportSpreadsheetFlow } from "../../flows/reports/export-report-spreadsheet.flow";
import { mockReportsApiFlow } from "../../flows/reports/mock-reports-api.flow";
import { openReportsPageFlow } from "../../flows/reports/open-reports-page.flow";
import {
  addReportConditionFlow,
  openReportFiltersFlow,
  removeReportConditionFlow,
  resetReportFlow,
} from "../../flows/reports/report-filters.flow";
import {
  openSavedReportConfigurationsFlow,
  saveReportConfigurationFlow,
} from "../../flows/reports/save-report-configuration.flow";
import { selectReportSubjectFlow } from "../../flows/reports/select-report-subject.flow";

test("reports render results, reset, switch subjects, filter nested groups, save and download", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    const lastSubmittedQuery = () => reportsApi.submittedQueries.at(-1);

    await openReportsPageFlow(page);
    const learnerRow = page.getByRole("row").filter({ hasText: "Mina Shah" });
    await expect(learnerRow).toContainText("Security Essentials");
    await expect(learnerRow).toContainText("Customer journey");
    await expect(learnerRow).toContainText("87%");
    await expect(learnerRow).toContainText("2026");
    await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

    await openReportFiltersFlow(page);
    await addReportConditionFlow(page);
    const rootField = page.getByRole("combobox", { name: "Field" }).first();
    const rootOperator = page.getByRole("combobox", { name: "Operator" }).first();
    await chooseReportOptionFlow(page, rootField, "Learner name or email");
    await chooseReportOptionFlow(page, rootOperator, "Contains");
    await page.getByRole("textbox", { name: "Value" }).fill("mina@exa");
    await applyReportFlow(page);
    await expect.poll(lastSubmittedQuery).toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "contains", value: "mina@exa" }],
      },
    });

    await chooseReportOptionFlow(page, rootOperator, "Is");
    await chooseReportOptionFlow(page, page.getByRole("combobox", { name: "Value" }), "Mina Shah");
    await applyReportFlow(page);
    await expect.poll(lastSubmittedQuery).toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "eq", value: REPORTS_IDS.learner }],
      },
    });
    await removeReportConditionFlow(page);

    await page.getByRole("button", { name: "Add nested group" }).click();
    const nestedGroup = page.getByTestId(REPORTS_HANDLES.NESTED_GROUP);
    await expect(nestedGroup).toBeVisible();
    await nestedGroup.getByRole("button", { name: "Add condition" }).click();
    const nestedMatching = nestedGroup.getByRole("combobox", { name: "Condition matching" });
    await chooseReportOptionFlow(page, nestedMatching, "any");
    await expect(nestedMatching).toHaveText(/any/);
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/2.*30/);
    await applyReportFlow(page);
    await expect.poll(lastSubmittedQuery).toMatchObject({
      filter: {
        match: "all",
        rules: [
          {
            match: "any",
            rules: [
              { field: "status", operator: "eq", value: "completed" },
              { field: "status", operator: "eq", value: "completed" },
            ],
          },
        ],
      },
    });

    await selectReportSubjectFlow(page, {
      tab: /Course performance/,
      subjectLabel: "Course",
      subjectName: "Security Essentials",
    });
    await expect(page.locator("h2").filter({ hasText: "Security Essentials" })).toBeVisible();
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ view: "course", subjectId: REPORTS_IDS.course });

    await selectReportSubjectFlow(page, {
      tab: /Development paths/,
      subjectLabel: "Development path",
      subjectName: "Customer journey",
    });
    await expect(page.locator("h2").filter({ hasText: "Customer journey" })).toBeVisible();
    await expect(
      page.locator("table thead th").filter({ hasText: /Security Essentials/i }),
    ).toBeVisible();
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ view: "developmentPaths", subjectId: REPORTS_IDS.path });

    await selectReportSubjectFlow(page, {
      tab: /Learner progress/,
      subjectLabel: "Learner",
      subjectName: "Mina Shah",
    });
    await expect(page.locator("h2").filter({ hasText: "Mina Shah" })).toBeVisible();
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ view: "learner", subjectId: REPORTS_IDS.learner });

    await saveReportConfigurationFlow(page, "Quarterly learner review");
    await openSavedReportConfigurationsFlow(page);
    await expect(
      page.getByRole("button", { name: /Quarterly learner review Personal/ }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    const download = await exportReportSpreadsheetFlow(page);
    await expect(
      page.locator('[role="status"]').filter({ hasText: "XLSX report is ready." }),
    ).toBeVisible();
    expect(reportsApi.getExportRequest()).toMatchObject({
      format: "xlsx",
      query: { view: "learner", subjectId: REPORTS_IDS.learner, page: 1, pageSize: 100 },
    });
    expect(download.suggestedFilename()).toBe("mentingo-report.xlsx");

    await resetReportFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/0.*30/);
    await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeEnabled();
    await applyReportFlow(page);
    await expect
      .poll(() => {
        const config = new URL(page.url()).searchParams.get("reportConfig");
        return config ? JSON.parse(config) : null;
      })
      .toMatchObject({
        subject: { id: REPORTS_IDS.learner, type: "learner" },
        groupIds: [],
        filters: { conditions: [], groups: [] },
      });
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ view: "learner", subjectId: REPORTS_IDS.learner, groupIds: [] });

    await addReportConditionFlow(page);
    await applyReportFlow(page);
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ filter: { match: "all", rules: [{ field: "status", operator: "eq" }] } });

    reportsApi.savedConfigurations.push(REPORTS_INACCESSIBLE_CONFIGURATION);
    await page.reload();
    await openSavedReportConfigurationsFlow(page);
    await page.getByRole("button", { name: /Inaccessible course filter Personal/ }).click();
    await expect(page.getByRole("alert")).toContainText("no longer access");
    await expect(page.getByRole("combobox", { name: "Learner" })).toHaveText(/Mina Shah/);
    await expect(page.getByRole("combobox", { name: "Groups" })).toHaveText(/All groups/);
    await removeReportConditionFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/0.*30/);
    await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeEnabled();
    await applyReportFlow(page);
    await expect
      .poll(lastSubmittedQuery)
      .toMatchObject({ view: "learner", subjectId: REPORTS_IDS.learner, groupIds: [] });
  });
});
