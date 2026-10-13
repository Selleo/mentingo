import { expect, test } from "@playwright/test";

import { REPORTS_HANDLES } from "../../data/reports/handles";

import type { Locator, Page } from "@playwright/test";

const ids = {
  learner: "33333333-3333-4333-8333-333333333333",
  course: "44444444-4444-4444-8444-444444444444",
  path: "55555555-5555-4555-8555-555555555555",
  group: "66666666-6666-4666-8666-666666666666",
  export: "77777777-7777-4777-8777-777777777777",
  config: "88888888-8888-4888-8888-888888888888",
  owner: "99999999-9999-4999-8999-999999999999",
  inaccessibleCourse: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
} as const;

const reportResult = {
  rows: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      learner: { id: ids.learner, name: "Mina Shah", email: "mina@example.com" },
      course: { id: ids.course, title: "Security Essentials" },
      path: { id: ids.path, title: "Customer journey" },
      status: "completed",
      progress: 100,
      score: 87,
      attempts: 2,
      certificate: { status: "active", issuedAt: "2026-04-14T12:00:00.000Z" },
      enrolledAt: "2026-02-02T09:00:00.000Z",
      completedAt: "2026-04-14T12:00:00.000Z",
      lastActivityAt: "2026-04-14T12:00:00.000Z",
      groupIds: [ids.group],
      pathCourses: [
        {
          courseId: ids.course,
          courseTitle: "Security Essentials",
          status: "inProgress",
          progress: 75,
          enrolledAt: "2026-02-02T09:00:00.000Z",
          completedAt: null,
        },
      ],
    },
  ],
  metrics: {
    learners: 1,
    platformCourses: 1,
    activeLearners30d: 1,
    courseEnrollments: 1,
    courseCompletions: 1,
    courseCompletionRate: 100,
    averageProgress: 100,
    averageScore: 87,
    activeCertificates: 1,
    certificatesIssued: 1,
    developmentPathsCompleted: 1,
  },
  breakdowns: {
    groups: [
      {
        id: ids.group,
        label: "Product team",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
    courses: [
      {
        id: ids.course,
        label: "Security Essentials",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
    paths: [
      {
        id: ids.path,
        label: "Customer journey",
        learners: 1,
        courseEnrollments: 1,
        completionRate: 100,
      },
    ],
  },
  total: 1,
  page: 1,
  pageSize: 10,
  capturedAt: "2026-04-14T12:00:00.000Z",
};

const chooseOption = async (page: Page, combobox: Locator, option: string) => {
  await combobox.click();
  await page.getByRole("option", { name: option, exact: true }).click();
};

const loginAsSeededAdmin = async (page: Page) => {
  const tenantOrigin = process.env.REPORTS_E2E_TENANT_ORIGIN || "https://tenant1.lms.localhost";
  const login = await page.context().request.post("http://localhost:3000/api/auth/login", {
    data: { email: "admin@example.com", password: "password" },
    headers: { Origin: tenantOrigin, Referer: `${tenantOrigin}/` },
  });
  expect(login).toBeOK();
};

test("reports render results, reset, switch subjects, filter nested groups, save and download", async ({
  page,
  baseURL,
}) => {
  const appOrigin = new URL(baseURL!).origin;
  await loginAsSeededAdmin(page);

  let savedConfigurations: Array<Record<string, unknown>> = [];
  const submittedQueries: Array<Record<string, unknown>> = [];
  let exportRequest: Record<string, unknown> | undefined;
  await page.route("**/api/report/options*", (route) =>
    route.fulfill({
      json: {
        data: {
          groups: [{ id: ids.group, label: "Product team" }],
          learners: [{ id: ids.learner, label: "Mina Shah" }],
          courses: [{ id: ids.course, label: "Security Essentials" }],
          paths: [{ id: ids.path, label: "Customer journey" }],
          canManageShared: true,
        },
      },
    }),
  );
  await page.route("**/api/report/configurations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { data: savedConfigurations } });
      return;
    }
    const body = route.request().postDataJSON() as {
      name: string;
      visibility: string;
      query: Record<string, unknown>;
    };
    const saved = {
      id: ids.config,
      name: body.name,
      visibility: body.visibility,
      query: body.query,
      ownerId: ids.owner,
      isAvailable: true,
      updatedAt: new Date().toISOString(),
    };
    savedConfigurations = [saved];
    await route.fulfill({ json: { data: saved } });
  });
  await page.route("**/api/report/query", async (route) => {
    submittedQueries.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ json: { data: reportResult } });
  });
  await page.route("**/api/report/exports", (route) => {
    exportRequest = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      json: {
        data: {
          id: ids.export,
          format: "xlsx",
          status: "processing",
          expiresAt: null,
          failureCode: null,
        },
      },
    });
  });
  await page.route(`**/api/report/exports/${ids.export}`, (route) =>
    route.fulfill({
      json: {
        data: {
          id: ids.export,
          format: "xlsx",
          status: "completed",
          expiresAt: "2026-04-15T12:00:00.000Z",
          failureCode: null,
        },
      },
    }),
  );
  await page.route(`**/api/report/exports/${ids.export}/download`, (route) =>
    route.fulfill({ body: "mock spreadsheet", contentType: "application/octet-stream" }),
  );

  await page.goto(`${appOrigin}/reports`);
  const learnerRow = page.getByRole("row").filter({ hasText: "Mina Shah" });
  await expect(learnerRow).toContainText("Security Essentials");
  await expect(learnerRow).toContainText("Customer journey");
  await expect(learnerRow).toContainText("87%");
  await expect(learnerRow).toContainText("2026");
  await expect(page.getByText("1", { exact: true }).first()).toBeVisible();

  await page.getByTestId(REPORTS_HANDLES.FILTERS_TOGGLE).click();
  await page.getByTestId(REPORTS_HANDLES.ADD_CONDITION).click();
  const rootField = page.getByRole("combobox", { name: "Field" }).first();
  const rootOperator = page.getByRole("combobox", { name: "Operator" }).first();
  await chooseOption(page, rootField, "Learner name or email");
  await chooseOption(page, rootOperator, "Contains");
  await page.getByRole("textbox", { name: "Value" }).fill("mina@exa");
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "contains", value: "mina@exa" }],
      },
    });

  await chooseOption(page, rootOperator, "Is");
  await chooseOption(page, page.getByRole("combobox", { name: "Value" }), "Mina Shah");
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({
      filter: {
        match: "all",
        rules: [{ field: "learner", operator: "eq", value: ids.learner }],
      },
    });
  await page.getByRole("button", { name: "Remove condition" }).first().click();

  await page.getByRole("button", { name: "Add nested group" }).click();
  const nestedGroup = page.getByTestId("reports-nested-group");
  await expect(nestedGroup).toBeVisible();
  await nestedGroup.getByRole("button", { name: "Add condition" }).click();
  const nestedMatching = nestedGroup.getByRole("combobox", { name: "Condition matching" });
  await chooseOption(page, nestedMatching, "any");
  await expect(nestedMatching).toHaveText(/any/);
  await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/2.*30/);
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({
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

  await page.getByRole("tab", { name: /Course performance/ }).click();
  await chooseOption(page, page.getByRole("combobox", { name: "Course" }), "Security Essentials");
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect(page.locator("h2").filter({ hasText: "Security Essentials" })).toBeVisible();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({ view: "course", subjectId: ids.course });

  await page.getByRole("tab", { name: /Development paths/ }).click();
  await chooseOption(
    page,
    page.getByRole("combobox", { name: "Development path" }),
    "Customer journey",
  );
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect(page.locator("h2").filter({ hasText: "Customer journey" })).toBeVisible();
  await expect(
    page.locator("table thead th").filter({ hasText: /Security Essentials/i }),
  ).toBeVisible();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({ view: "developmentPaths", subjectId: ids.path });

  await page.getByRole("tab", { name: /Learner progress/ }).click();
  await chooseOption(page, page.getByRole("combobox", { name: "Learner" }), "Mina Shah");
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect(page.locator("h2").filter({ hasText: "Mina Shah" })).toBeVisible();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({ view: "learner", subjectId: ids.learner });

  const savedConfigurationsMenu = page.getByRole("button", { name: /Saved configurations/ });
  await savedConfigurationsMenu.click();
  await page.getByRole("button", { name: "Save configuration" }).click();
  await page.getByLabel("Configuration name").fill("Quarterly learner review");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await savedConfigurationsMenu.click();
  await expect(
    page.getByRole("button", { name: /Quarterly learner review Personal/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export spreadsheet" }).click();
  const download = await downloadPromise;
  await expect(
    page.locator('[role="status"]').filter({ hasText: "XLSX report is ready." }),
  ).toBeVisible();
  expect(exportRequest).toMatchObject({
    format: "xlsx",
    query: { view: "learner", subjectId: ids.learner, page: 1, pageSize: 100 },
  });
  expect(download.suggestedFilename()).toBe("mentingo-report.xlsx");

  await page.getByTestId(REPORTS_HANDLES.RESET_ALL).click();
  await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/0.*30/);
  await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeEnabled();
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => {
      const params = new URL(page.url()).searchParams;
      const config = params.get("reportConfig");
      return config ? JSON.parse(config) : null;
    })
    .toMatchObject({
      subject: { id: ids.learner, type: "learner" },
      groupIds: [],
      filters: { conditions: [], groups: [] },
    });
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({
      view: "learner",
      subjectId: ids.learner,
      groupIds: [],
    });

  await page.getByTestId(REPORTS_HANDLES.ADD_CONDITION).click();
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({ filter: { match: "all", rules: [{ field: "status", operator: "eq" }] } });

  savedConfigurations.push({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Inaccessible course filter",
    visibility: "personal",
    query: {
      view: "learner",
      timezone: "UTC",
      groupIds: [],
      subjectId: ids.learner,
      filter: {
        match: "all",
        rules: [{ field: "courseId", operator: "eq", value: ids.inaccessibleCourse }],
      },
    },
    ownerId: ids.owner,
    isAvailable: false,
    failureCode: "references_unavailable",
    updatedAt: "2026-04-14T12:00:00.000Z",
  });
  await page.reload();
  await page.getByRole("button", { name: /Saved configurations/ }).click();
  await page.getByRole("button", { name: /Inaccessible course filter Personal/ }).click();
  await expect(page.getByRole("alert")).toContainText("no longer access");
  await expect(page.getByRole("combobox", { name: "Learner" })).toHaveText(/Mina Shah/);
  await expect(page.getByRole("combobox", { name: "Groups" })).toHaveText(/All groups/);
  await page.getByRole("button", { name: "Remove condition" }).click();
  await expect(page.getByTestId(REPORTS_HANDLES.CONDITION_COUNT)).toHaveText(/0.*30/);
  await expect(page.getByTestId(REPORTS_HANDLES.APPLY)).toBeEnabled();
  await page.getByTestId(REPORTS_HANDLES.APPLY).click();
  await expect
    .poll(() => submittedQueries.at(-1))
    .toMatchObject({ view: "learner", subjectId: ids.learner, groupIds: [] });
});
