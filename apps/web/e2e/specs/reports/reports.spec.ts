import { stat } from "node:fs/promises";

import { USER_ROLE } from "~/config/userRoles";
import { formatReportDate } from "~/modules/Reports/utils/reports.utils";

import { REPORTS_HANDLES } from "../../data/reports/handles";
import {
  REPORTS_IDS,
  REPORTS_INACCESSIBLE_CONFIGURATION,
  REPORTS_RESULT,
} from "../../data/reports/reports.data";
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

const LEARNER_SUBJECT = { view: "learner", subjectId: REPORTS_IDS.learner } as const;
const [RESULT_ROW] = REPORTS_RESULT.rows;

test("reports render learner results", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await mockReportsApiFlow(page);
    await openReportsPageFlow(page);

    const learnerRow = page.getByTestId(REPORTS_HANDLES.resultRow(RESULT_ROW.id));
    await expect(learnerRow).toContainText(RESULT_ROW.learner.name);
    await expect(learnerRow).toContainText(RESULT_ROW.course.title);
    await expect(learnerRow).toContainText(RESULT_ROW.path.title);
    await expect(learnerRow).toContainText(`${RESULT_ROW.score}%`);
    await expect(learnerRow).toContainText(
      formatReportDate(
        RESULT_ROW.lastActivityAt,
        "en",
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      ),
    );
    await expect(
      page
        .getByTestId(REPORTS_HANDLES.metric("learners"))
        .getByTestId(REPORTS_HANDLES.METRIC_VALUE),
    ).toHaveText(String(REPORTS_RESULT.metrics.learners));
  });
});

test("reports filter by learner condition and nested groups", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    await openReportsPageFlow(page);

    await openReportFiltersFlow(page);
    await addReportConditionFlow(page);
    const condition = page.getByTestId(REPORTS_HANDLES.CONDITION).first();
    const operator = condition.getByTestId(REPORTS_HANDLES.CONDITION_OPERATOR);
    await chooseReportOptionFlow(
      page,
      condition.getByTestId(REPORTS_HANDLES.CONDITION_FIELD),
      REPORTS_HANDLES.option("learner"),
    );
    await chooseReportOptionFlow(
      page,
      operator,
      REPORTS_HANDLES.conditionOperatorOption("contains"),
    );
    await condition.getByTestId(REPORTS_HANDLES.CONDITION_VALUE_INPUT).fill("mina@exa");
    await applyReportFlow(page);
    await expect.poll(reportsApi.lastSubmittedQuery).toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "contains", value: "mina@exa" }],
      },
    });

    await chooseReportOptionFlow(page, operator, REPORTS_HANDLES.conditionOperatorOption("eq"));
    await chooseReportOptionFlow(
      page,
      condition.getByTestId(REPORTS_HANDLES.CONDITION_VALUE_PICKER),
      REPORTS_HANDLES.option(REPORTS_IDS.learner),
    );
    await applyReportFlow(page);
    await expect.poll(reportsApi.lastSubmittedQuery).toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "eq", value: REPORTS_IDS.learner }],
      },
    });
    await removeReportConditionFlow(page);

    await page.getByTestId(REPORTS_HANDLES.ADD_NESTED_GROUP).click();
    const nestedGroup = page.getByTestId(REPORTS_HANDLES.NESTED_GROUP);
    await nestedGroup.getByTestId(REPORTS_HANDLES.NESTED_ADD_CONDITION).click();
    await chooseReportOptionFlow(
      page,
      nestedGroup.getByTestId(REPORTS_HANDLES.MATCHING),
      REPORTS_HANDLES.matchingOption("or"),
    );
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveAttribute(
      "data-count",
      "2",
    );
    await applyReportFlow(page);
    await expect.poll(reportsApi.lastSubmittedQuery).toMatchObject({
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
  });
});

test("reports switch between course, development path and learner subjects", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    await openReportsPageFlow(page);
    const resultTitle = page.getByTestId(REPORTS_HANDLES.RESULT_TITLE);

    await selectReportSubjectFlow(page, { view: "course", subjectId: REPORTS_IDS.course });
    await expect(resultTitle).toContainText(RESULT_ROW.course.title);
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ view: "course", subjectId: REPORTS_IDS.course });

    await selectReportSubjectFlow(page, { view: "developmentPaths", subjectId: REPORTS_IDS.path });
    await expect(resultTitle).toContainText(RESULT_ROW.path.title);
    await expect(page.getByTestId(REPORTS_HANDLES.RESULTS_TABLE)).toContainText(
      RESULT_ROW.course.title,
    );
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ view: "developmentPaths", subjectId: REPORTS_IDS.path });

    await selectReportSubjectFlow(page, LEARNER_SUBJECT);
    await expect(resultTitle).toContainText(RESULT_ROW.learner.name);
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ view: "learner", subjectId: REPORTS_IDS.learner });
  });
});

test("reports save a configuration and download the spreadsheet", async ({ withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    await openReportsPageFlow(page);
    await selectReportSubjectFlow(page, LEARNER_SUBJECT);

    await saveReportConfigurationFlow(page, "Quarterly learner review");
    await openSavedReportConfigurationsFlow(page);
    await expect(
      page.getByTestId(REPORTS_HANDLES.savedConfiguration(REPORTS_IDS.config)),
    ).toContainText("Quarterly learner review");
    await page.keyboard.press("Escape");

    const download = await exportReportSpreadsheetFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.EXPORT_DOWNLOAD)).toBeVisible();
    expect(reportsApi.getExportRequest()).toMatchObject({
      format: "xlsx",
      query: { view: "learner", subjectId: REPORTS_IDS.learner, page: 1, pageSize: 100 },
    });
    expect(download.suggestedFilename()).toBe("mentingo-report.xlsx");
  });
});

test("reports reset clears the subject, groups and conditions while keeping the view", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    await openReportsPageFlow(page);
    await selectReportSubjectFlow(page, LEARNER_SUBJECT);
    await openReportFiltersFlow(page);
    await addReportConditionFlow(page);
    await applyReportFlow(page);
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ filter: { match: "all", rules: [{ field: "status", operator: "eq" }] } });

    await resetReportFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveAttribute(
      "data-count",
      "0",
    );
    await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeDisabled();
    await expect
      .poll(() => {
        const config = new URL(page.url()).searchParams.get("reportConfig");
        return config ? JSON.parse(config) : null;
      })
      .toMatchObject({
        view: "learner",
        subject: null,
        groupIds: [],
        filters: { conditions: [], groups: [] },
      });
    // The cleared learner report was already loaded when the tab opened, so it may come from cache.
    await expect(page.getByTestId(REPORTS_HANDLES.RESULT_TITLE)).not.toContainText(
      RESULT_ROW.learner.name,
    );
    await expect(page.getByTestId(REPORTS_HANDLES.SUBJECT_PICKER)).not.toContainText(
      RESULT_ROW.learner.name,
    );

    await addReportConditionFlow(page);
    await applyReportFlow(page);
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ filter: { match: "all", rules: [{ field: "status", operator: "eq" }] } });
  });
});

test("reports recover from a saved configuration with inaccessible references", async ({
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const reportsApi = await mockReportsApiFlow(page);
    reportsApi.savedConfigurations.push(REPORTS_INACCESSIBLE_CONFIGURATION);
    await openReportsPageFlow(page);

    await openSavedReportConfigurationsFlow(page);
    await page
      .getByTestId(REPORTS_HANDLES.savedConfiguration(REPORTS_INACCESSIBLE_CONFIGURATION.id))
      .click();
    await expect(page.getByTestId(REPORTS_HANDLES.WARNING)).toBeVisible();
    await expect(page.getByTestId(REPORTS_HANDLES.SUBJECT_PICKER)).toContainText(
      RESULT_ROW.learner.name,
    );
    // The inaccessible group is dropped, so the picker is back on "all groups".
    await expect(page.getByTestId(REPORTS_HANDLES.GROUPS_PICKER)).toHaveAttribute(
      "data-selected-count",
      "0",
    );
    await removeReportConditionFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveAttribute(
      "data-count",
      "0",
    );
    await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeEnabled();
    await applyReportFlow(page);
    await expect
      .poll(reportsApi.lastSubmittedQuery)
      .toMatchObject({ view: "learner", subjectId: REPORTS_IDS.learner, groupIds: [] });
  });
});

test("reports run a real course report and export it as a spreadsheet", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const userFactory = factories.createUserFactory();
    const prefix = `reports-smoke-${Date.now()}`;
    const category = await categoryFactory.create(`${prefix}-category`);
    cleanup.add(() => categoryFactory.delete(category.id));
    const course = await courseFactory.create({
      title: `${prefix}-course`,
      categoryId: category.id,
    });
    cleanup.add(() => courseFactory.delete(course.id));
    await courseFactory.update(course.id, { status: "published", language: "en" });
    const learner = await userFactory.create({ email: `${prefix}@example.com` });
    cleanup.add(() => userFactory.delete(learner.id));
    await factories.createEnrollmentFactory().enrollUsers(course.id, [learner.id]);

    await openReportsPageFlow(page);
    await selectReportSubjectFlow(page, {
      view: "course",
      subjectId: course.id,
      search: course.title,
    });

    const learnerName = `${learner.firstName} ${learner.lastName}`;
    const resultsTable = page.getByTestId(REPORTS_HANDLES.RESULTS_TABLE);
    await expect(page.getByTestId(REPORTS_HANDLES.RESULT_TITLE)).toContainText(course.title);
    await expect(resultsTable).toContainText(learnerName);

    // A new condition filters on status "completed"; the enrolled learner has not started yet.
    await openReportFiltersFlow(page);
    await addReportConditionFlow(page);
    await applyReportFlow(page);
    await expect(resultsTable).not.toContainText(learnerName);
    await chooseReportOptionFlow(
      page,
      page
        .getByTestId(REPORTS_HANDLES.CONDITION)
        .getByTestId(REPORTS_HANDLES.CONDITION_VALUE_PICKER),
      REPORTS_HANDLES.option("notStarted"),
    );
    await applyReportFlow(page);
    await expect(resultsTable).toContainText(learnerName);

    const download = await exportReportSpreadsheetFlow(page);
    await expect(page.getByTestId(REPORTS_HANDLES.EXPORT_DOWNLOAD)).toBeVisible();
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    expect((await stat(await download.path())).size).toBeGreaterThan(0);
  });
});
