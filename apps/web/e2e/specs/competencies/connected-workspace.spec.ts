import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { COMPETENCIES_HANDLES } from "../../data/competencies/handles";
import { UserFactory } from "../../factories/user.factory";
import { createFixtureApiClient } from "../../utils/api-client";

import type { BrowserContext, Cookie, Page } from "@playwright/test";
import type { SupportedLanguages } from "@repo/shared";

// This acceptance scenario uses an already connected disposable tenant, without database setup.
const fixture = process.env.COMPETENCIES_E2E_FIXTURE
  ? (JSON.parse(process.env.COMPETENCIES_E2E_FIXTURE) as {
      host: string;
      people: Record<"admin" | "student" | "manager" | "verifier", { id: string; email: string }>;
    })
  : null;
test.skip(!fixture, "Provide COMPETENCIES_E2E_FIXTURE for an existing connected test tenant");

async function openPlanAction(page: Page, objective: string) {
  const table = page.getByRole("table", { name: "Development Plans", exact: true });
  const action = table.getByRole("button", { name: objective, exact: true });
  for (let index = 0; index < 100 && !(await action.count()); index++) {
    const firstRow = table.getByRole("row").nth(1);
    const before = await firstRow.textContent();
    const next = page.getByRole("button", { name: "Next", exact: true });
    await expect(next).toBeEnabled();
    await next.click();
    await expect(firstRow).not.toHaveText(before ?? "");
  }
  await action.click();
  await expect(page.getByRole("dialog").locator("details, summary")).toHaveCount(0);
}

async function findReviewEvidence(
  page: Page,
  note: string,
  kind: "review-pending" | "review-history" = "review-pending",
) {
  const section = page.getByRole("region", {
    name: kind === "review-pending" ? "Pending Approval" : "Evidence history",
    exact: true,
  });
  await expect(section).toBeVisible();
  await expect(section.getByText("Loading competencies...", { exact: true })).toHaveCount(0);
  const move = async (direction: "Previous" | "Next") => {
    const counter = section.getByText(/^Showing \d+-\d+ of \d+ results$/);
    const before = await counter.textContent();
    await section.getByRole("button", { name: direction, exact: true }).click();
    await expect(counter).not.toHaveText(before ?? "");
    await expect(section.getByText("Loading competencies...", { exact: true })).toHaveCount(0);
    await expect(section.locator("article").first()).toBeVisible();
  };
  const previous = section.getByRole("button", { name: "Previous", exact: true });
  while ((await previous.count()) && (await previous.isEnabled())) await move("Previous");
  const record = section.getByTestId(/^competency-evidence-/).filter({ hasText: note });
  for (let index = 0; index < 100 && !(await record.count()); index++) {
    await expect(section.getByRole("button", { name: "Next", exact: true })).toBeEnabled();
    await move("Next");
  }
  await expect(record).toBeVisible();
  return record;
}

async function authenticateContext(
  context: BrowserContext,
  origin: string,
  email: string,
  password: string,
) {
  await context.clearCookies();
  const apiOrigin = process.env.VITE_API_URL || origin;
  const response = await context.request.post(`${apiOrigin}/api/auth/login`, {
    data: { email, password },
    headers: { Origin: origin, Referer: `${origin}/` },
  });
  expect(response, "Connected fixture login failed").toBeOK();
}

test("manager filters, bounded records and action details preserve the page frame", async ({
  browser,
}, testInfo) => {
  const tenant = fixture!;
  const context = await browser.newContext({ viewport: { width: 2222, height: 1912 } });
  const page = await context.newPage();
  const api = createFixtureApiClient();
  try {
    await authenticateContext(
      context,
      tenant.host,
      tenant.people.manager.email,
      process.env.COMPETENCIES_E2E_PASSWORD!,
    );
    await api.syncFromContext(context, tenant.host);
    await page.goto(`${tenant.host}/competencies`);
    await expect(page.getByTestId(COMPETENCIES_HANDLES.PAGE)).toBeVisible();
    const workspace = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({
        language: "en",
        teamOnly: "true",
      })
    ).data.data;
    const managed = workspace.people.filter((person) => person.canPlan);
    const profile = workspace.publishedProfiles.find((item) => {
      const count = workspace.subjects.filter(
        (subject) =>
          subject.profileId === item.id && managed.some((person) => person.id === subject.id),
      ).length;
      return count > 0 && count < managed.length;
    });
    expect(profile, "The demo needs multiple assigned job profiles").toBeTruthy();
    const selectedIds = workspace.subjects
      .filter(
        (item) => item.profileId === profile!.id && managed.some((person) => person.id === item.id),
      )
      .map((item) => item.id);
    await page.getByTestId(COMPETENCIES_HANDLES.TEAM).click();
    const selector = page.getByRole("combobox");
    await expect(selector).toBeVisible();
    await selector.click();
    await page.getByRole("option", { name: profile!.name, exact: true }).click();
    await expect(
      page.getByText(`Employees: ${selectedIds.length}`, { exact: true }).first(),
    ).toBeVisible();
    const attention = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Needs Your Attention", exact: true }) });
    for (const person of managed.filter((person) => !selectedIds.includes(person.id)))
      await expect(attention.getByRole("heading", { name: person.name, exact: true })).toHaveCount(
        0,
      );
    await page.screenshot({
      path: testInfo.outputPath("manager-filtered-team.png"),
      fullPage: true,
    });
    await page.route("**/api/competencies/workspace*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });
    await page.getByTestId(COMPETENCIES_HANDLES.MATRIX).click();
    await expect(page.getByRole("table", { name: "Matrix", exact: true })).toBeVisible();
    const matrixHeader = await page
      .getByRole("heading", { level: 1, name: "Team Matrix", exact: true })
      .elementHandle();
    const matrixSelector = page.getByRole("combobox");
    const currentProfileName = await matrixSelector.innerText();
    const anotherProfile = workspace.publishedProfiles.find(
      (item) =>
        item.name !== currentProfileName &&
        workspace.subjects.some(
          (subject) =>
            subject.profileId === item.id && managed.some((person) => person.id === subject.id),
        ),
    )!;
    const matrixResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/competencies/workspace") &&
        response.url().includes(anotherProfile.id),
    );
    await matrixSelector.click();
    await page.getByRole("option", { name: anotherProfile.name, exact: true }).click();
    await matrixResponse;
    await expect(page.getByRole("table", { name: "Matrix", exact: true })).toBeVisible();
    expect(await matrixHeader!.evaluate((element) => element.isConnected)).toBe(true);
    await page.getByTestId(COMPETENCIES_HANDLES.DOCUMENTS).click();
    await expect(
      page.getByRole("heading", { name: "Documents to submit", exact: true }),
    ).toBeVisible();
    const header = await page
      .getByRole("heading", { level: 1, name: "Documents", exact: true })
      .elementHandle();
    const peopleSelector = page.getByRole("combobox", { name: "Person", exact: true });
    const other = managed.find((person) => person.id !== tenant.people.manager.id)!;
    const response = page.waitForResponse(
      (response) =>
        response.url().includes("/competencies/workspace") && response.url().includes(other.id),
    );
    await peopleSelector.click();
    await page.getByRole("option", { name: other.name, exact: true }).click();
    await response;
    await expect(
      page.getByRole("heading", { name: "Documents to submit", exact: true }),
    ).toBeVisible();
    expect(await header!.evaluate((element) => element.isConnected)).toBe(true);
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    const plans = page.getByRole("table", { name: "Development Plans", exact: true });
    await expect(plans).toBeVisible();
    expect(await plans.getByRole("row").count()).toBeLessThanOrEqual(11);
    await expect(plans.getByText("Cancelled", { exact: true })).toHaveCount(0);
    const result = (
      await api.api.competenciesControllerGetCompetencyRecords({
        kind: "actions",
        page: "1",
        pageSize: "10",
      })
    ).data.data;
    expect(result.actions.length).toBeLessThanOrEqual(10);
    expect(result.actions.every((item) => item.status !== "cancelled")).toBe(true);
    await plans.getByRole("button").first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("details, summary")).toHaveCount(0);
    const status = dialog.getByRole("combobox", { name: "Action status", exact: true });
    await expect(status).toBeVisible();
    expect((await status.boundingBox())!.width).toBeGreaterThan(
      (await dialog.boundingBox())!.width * 0.75,
    );
    const history = dialog.getByRole("table", { name: "Change history", exact: true });
    await expect(history).toBeVisible();
    for (const width of [2083, 390]) {
      await page.setViewportSize({ width, height: 1912 });
      const singleLine = await history.locator("tbody tr").evaluateAll((rows) =>
        rows.every((row) =>
          [row.children[2], row.children[3].firstElementChild!].every((element) => {
            const range = document.createRange();
            range.selectNodeContents(element);
            return range.getClientRects().length === 1;
          }),
        ),
      );
      expect(singleLine, `History dates and statuses must stay on one line at ${width}px`).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 2222, height: 1912 });
    await page.screenshot({
      path: testInfo.outputPath("manager-action-details-2222.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog).toBeInViewport({ ratio: 1 });
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath("manager-action-details-390.png"),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await page.setViewportSize({ width: 2083, height: 1912 });
    for (const mode of ["create", "edit"]) {
      if (mode === "create") {
        await page.getByRole("button", { name: "Create plan", exact: true }).click();
      } else {
        await plans.getByRole("button").first().click();
        await dialog.getByRole("button", { name: "Edit", exact: true }).click();
      }
      const editor = page.getByRole("dialog", {
        name: mode === "create" ? "Create plan" : "Edit",
        exact: true,
      });
      await expect(editor.locator('input[type="date"]')).toHaveCount(0);
      const dueDate = editor.getByRole("button", { name: "Due date (optional)", exact: true });
      await dueDate.click();
      const calendar = editor.getByRole("grid");
      await expect(calendar).toBeVisible();
      expect(await editor.evaluate((element) => element.scrollTop)).toBe(0);
      await page.screenshot({
        path: testInfo.outputPath(`manager-${mode}-calendar-2083.png`),
        animations: "disabled",
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await expect(calendar).toBeInViewport({ ratio: 1 });
      expect(await editor.evaluate((element) => element.scrollTop)).toBe(0);
      await expect(editor.getByRole("heading", { level: 2 })).toBeInViewport({ ratio: 1 });
      await page.screenshot({
        path: testInfo.outputPath(`manager-${mode}-calendar-390.png`),
        animations: "disabled",
      });
      await page.setViewportSize({ width: 2083, height: 1912 });
      await calendar.getByRole("gridcell", { name: "15", exact: true }).click();
      await dueDate.click();
      await expect(dueDate).toContainText("15");
      await editor.getByRole("button", { name: "Clear date", exact: true }).click();
      await expect(dueDate).toHaveText("Select date");
      await page.screenshot({ path: testInfo.outputPath(`manager-${mode}-plan-calendar.png`) });
      await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  } finally {
    await context.close();
  }
});

test("administrator plan pages and verifier queues match their bounded record totals", async ({
  browser,
}, testInfo) => {
  const tenant = fixture!;
  for (const role of ["admin", "verifier"] as const) {
    const context = await browser.newContext({ viewport: { width: 2083, height: 1912 } });
    const page = await context.newPage();
    const api = createFixtureApiClient();
    try {
      await authenticateContext(
        context,
        tenant.host,
        tenant.people[role].email,
        process.env.COMPETENCIES_E2E_PASSWORD!,
      );
      await api.syncFromContext(context, tenant.host);
      await page.goto(`${tenant.host}/competencies`);
      await expect(page.getByTestId(COMPETENCIES_HANDLES.PAGE)).toBeVisible();
      await expect(page.getByRole("tab", { name: "Validation Rules", exact: true })).toHaveCount(0);
      if (role === "admin") {
        await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
        const table = page.getByRole("table", { name: "Development Plans", exact: true });
        const first = (
          await api.api.competenciesControllerGetCompetencyRecords({
            kind: "actions",
            page: "1",
            pageSize: "10",
          })
        ).data.data;
        for (let index = 1; index <= Math.ceil(first.total / 10); index++) {
          const result =
            index === 1
              ? first
              : (
                  await api.api.competenciesControllerGetCompetencyRecords({
                    kind: "actions",
                    page: String(index),
                    pageSize: "10",
                  })
                ).data.data;
          await expect(table.getByRole("row")).toHaveCount(result.actions.length + 1);
          for (const action of result.actions)
            await expect(
              table.getByRole("button", { name: action.objective, exact: true }).first(),
            ).toBeVisible();
          await expect(page.getByText("No development actions yet.", { exact: true })).toHaveCount(
            0,
          );
          if (index < Math.ceil(first.total / 10)) {
            const response = page.waitForResponse((response) => {
              const url = new URL(response.url());
              return (
                url.pathname.endsWith("/competencies/records") &&
                url.searchParams.get("kind") === "actions" &&
                url.searchParams.get("page") === String(index + 1)
              );
            });
            await page.getByRole("button", { name: "Next", exact: true }).click();
            await response;
          }
        }
        await page.screenshot({ path: testInfo.outputPath("administrator-last-plan-page.png") });
      } else {
        await page.getByTestId(COMPETENCIES_HANDLES.REVIEW).click();
        const pending = page.getByRole("region", { name: "Pending Approval", exact: true });
        const history = page.getByRole("region", { name: "Evidence history", exact: true });
        await expect(
          page.getByRole("heading", { level: 2, name: "Pending Approval", exact: true }),
        ).toHaveCount(0);
        for (const [kind, section] of [
          ["review-pending", pending],
          ["review-history", history],
        ] as const) {
          const result = (
            await api.api.competenciesControllerGetCompetencyRecords({
              kind,
              page: "1",
              pageSize: "10",
            })
          ).data.data;
          await expect(section.locator("article")).toHaveCount(result.evidence.length);
          await expect(section.locator("details, summary")).toHaveCount(0);
          expect(
            result.evidence.every((item) =>
              kind === "review-pending" ? item.status === "pending" : item.status !== "pending",
            ),
          ).toBe(true);
          if (result.total > 10) {
            const next = (
              await api.api.competenciesControllerGetCompetencyRecords({
                kind,
                page: "2",
                pageSize: "10",
              })
            ).data.data;
            await section.getByRole("button", { name: "Next", exact: true }).click();
            await expect(section.locator("article")).toHaveCount(next.evidence.length);
            for (const item of next.evidence)
              await expect(
                section.getByTestId(COMPETENCIES_HANDLES.EVIDENCE(item.id)),
              ).toBeVisible();
          }
        }
        await page.screenshot({
          path: testInfo.outputPath("verifier-pending-and-history.png"),
          fullPage: true,
        });
      }
    } finally {
      await context.close();
    }
  }
});

test("employee, manager, designated verifier and administrator share one competency workflow", async ({
  browser,
}, testInfo) => {
  const tenant = fixture!;
  const password = process.env.COMPETENCIES_E2E_PASSWORD;
  expect(password, "Provide credentials for the disposable test accounts").toBeTruthy();
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  const api = createFixtureApiClient();
  const sessions = new Map<string, Cookie[]>();
  const originalLanguages = new Map<keyof typeof tenant.people, SupportedLanguages>();
  const authenticate = async (role: keyof typeof tenant.people) => {
    const cookies = sessions.get(role);
    if (cookies) {
      await context.clearCookies();
      await context.addCookies(cookies);
    } else {
      await authenticateContext(context, tenant.host, tenant.people[role].email, password!);
      sessions.set(role, await context.cookies());
    }
    await api.syncFromContext(context, tenant.host);
    if (!originalLanguages.has(role)) {
      const settings = (await api.api.settingsControllerGetUserSettings()).data.data;
      originalLanguages.set(role, settings.language);
      await api.api.settingsControllerUpdateUserSettings({ language: "en" });
    }
  };
  const enter = async (role: keyof typeof tenant.people) => {
    await authenticate(role);
    await page.goto(`${tenant.host}/competencies`);
    await expect(page.getByTestId(COMPETENCIES_HANDLES.PAGE)).toBeVisible();
  };
  const capture = async (name: string) =>
    page.screenshot({
      path: testInfo.outputPath(`${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  const selectPerson = async (target: Page) => {
    const result = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data;
    const person = result.people.find((item) => item.id === tenant.people.student.id)!;
    await target.getByRole("combobox", { name: "Person", exact: true }).click();
    await target.getByRole("option", { name: person.name, exact: true }).click();
    return person;
  };
  let competencyId: string | undefined;
  let testProfileId: string | undefined;
  let originalProfileId: string | null = null;
  let profileAssigned = false;
  try {
    await enter("admin");
    const name = `Communication acceptance ${randomUUID().slice(0, 8)}`;
    const note = `Observed a clear conversation ${randomUUID()}`;
    const value = {
      name,
      description: "A clear explanation and check of understanding.",
      category: "Interpersonal",
      levels: [
        {
          id: "foundation",
          name: "Foundation",
          conditions: [
            {
              id: "conversation",
              kind: "document" as const,
              description: "Provide a conversation record",
              verifierIds: [tenant.people.verifier.id],
            },
            {
              id: "observed",
              kind: "observation" as const,
              description: "Demonstrate a clear conversation",
              verifierIds: [tenant.people.verifier.id],
            },
            {
              id: "follow-up",
              kind: "document" as const,
              description: "Provide a follow-up record",
              verifierIds: [tenant.people.verifier.id],
            },
          ],
        },
      ],
    };
    competencyId = (
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "save_competency",
        value,
      })
    ).data.data.id;
    const beforeAssignment = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({
        language: "en",
        subjectId: tenant.people.student.id,
      })
    ).data.data;
    const originalSubject = beforeAssignment.subjects.find(
      (item) => item.id === tenant.people.student.id,
    );
    const employee = beforeAssignment.people.find((item) => item.id === tenant.people.student.id);
    expect(originalSubject).toBeTruthy();
    expect(employee).toBeTruthy();
    originalProfileId = originalSubject!.profileId;
    // Employee gaps must belong to the person's actual job requirements.
    testProfileId = (
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "save_profile",
        value: {
          name: `Acceptance profile ${name}`,
          description: "Disposable workflow requirements",
          requirements: [{ competencyId, levelId: "foundation" }],
        },
      })
    ).data.data.id;
    profileAssigned = true;
    await page.reload();
    await page.getByTestId(COMPETENCIES_HANDLES.PEOPLE).click();
    await page.getByRole("combobox", { name: `Job profile: ${employee!.name}` }).click();
    await page.getByRole("option", { name: `Acceptance profile ${name}` }).click();
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.subjects.find((item) => item.id === tenant.people.student.id)?.profileId,
      )
      .toBe(testProfileId);
    await enter("student");
    await expect(page.getByTestId(COMPETENCIES_HANDLES.TEAM)).toHaveCount(0);
    await expect(page.getByTestId(COMPETENCIES_HANDLES.CATALOG)).toHaveCount(0);
    const own = (await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" }))
      .data.data;
    expect(own.standings.every((item) => item.subjectId === tenant.people.student.id)).toBe(true);
    const attentionRow = page.getByTestId(COMPETENCIES_HANDLES.ROW(competencyId));
    await attentionRow.getByRole("button", { name: `View details: ${name}` }).click();
    const details = page.getByRole("dialog", { name, exact: true });
    await expect(details).toContainText("Demonstrate a clear conversation");
    await capture("employee-level-details");
    await expect(details.getByRole("button", { name: "Confirm observation" })).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(details).toBeInViewport({ ratio: 1 });
    expect(await details.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await capture("employee-level-details-narrow");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await details.getByRole("button", { name: "Close", exact: true }).click();
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await expect(page.locator("details, summary")).toHaveCount(0);
    await page
      .getByTestId(COMPETENCIES_HANDLES.PLAN_STEP(competencyId, "conversation"))
      .getByRole("button", { name: "Documents", exact: true })
      .click();
    await expect(page.getByTestId(COMPETENCIES_HANDLES.DOCUMENTS)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await capture("employee-documents");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await capture("employee-documents-narrow");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page
      .getByTestId(COMPETENCIES_HANDLES.DOCUMENT(competencyId, "conversation"))
      .getByRole("button", { name: "Submit document", exact: true })
      .click();
    const submission = page.getByRole("dialog", { name: "Submit document", exact: true });
    await expect(submission.getByRole("combobox", { name: "Condition type" })).toHaveCount(0);
    await expect(submission.locator('input[type="datetime-local"]')).toHaveCount(0);
    await submission.getByRole("button", { name: "Fulfilled on (optional)", exact: true }).click();
    await expect(page.getByRole("grid")).toBeVisible();
    const calendarBounds = (await page.getByRole("grid").boundingBox())!;
    expect(calendarBounds.y + calendarBounds.height).toBeLessThanOrEqual(1080);
    await capture("employee-document-calendar");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("grid")).toBeInViewport({ ratio: 1 });
    const narrowCalendarBounds = (await page.getByRole("grid").boundingBox())!;
    expect(narrowCalendarBounds.x).toBeGreaterThanOrEqual(0);
    expect(narrowCalendarBounds.x + narrowCalendarBounds.width).toBeLessThanOrEqual(390);
    expect(narrowCalendarBounds.y).toBeGreaterThanOrEqual(0);
    expect(narrowCalendarBounds.y + narrowCalendarBounds.height).toBeLessThanOrEqual(844);
    await capture("employee-document-calendar-narrow");
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.getByRole("gridcell", { name: "1", exact: true }).first().click();
    await submission.getByRole("button", { name: "Fulfilled on (optional)", exact: true }).click();
    await submission.getByLabel("Note", { exact: true }).fill(note);
    await submission.getByLabel("Attachment (optional)").setInputFiles({
      name: "conversation.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n"),
    });
    await submission.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(submission).toHaveCount(0);
    await expect
      .poll(async () => {
        const record = (
          await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
        ).data.data.evidence.find(
          (item) => item.note === note && item.subjectId === tenant.people.student.id,
        );
        return { status: record?.status, hasAttachment: Boolean(record?.attachmentId) };
      })
      .toEqual({ status: "pending", hasAttachment: true });
    await enter("manager");
    const confirmationObjective = `Confirm a clear workplace conversation - ${name}`;
    const confirmationActionId = (
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "create_action",
        requestId: randomUUID(),
        value: {
          subjectId: tenant.people.student.id,
          competencyId,
          levelId: "foundation",
          kind: "practice",
          ownerId: tenant.people.manager.id,
          objective: confirmationObjective,
          dueDate: null,
        },
      })
    ).data.data.id;
    await page.reload();
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await openPlanAction(page, confirmationObjective);
    const action = page.getByTestId(COMPETENCIES_HANDLES.ACTION(confirmationActionId));
    await action.getByRole("button", { name: "Documents", exact: true }).click();
    await page
      .getByTestId(COMPETENCIES_HANDLES.DOCUMENT(competencyId, "follow-up"))
      .getByRole("button", { name: "Submit document", exact: true })
      .click();
    const linkedSubmission = page.getByRole("dialog", { name: "Submit document", exact: true });
    const linkedNote = `Action-linked document ${name}`;
    await linkedSubmission.getByLabel("Note", { exact: true }).fill(linkedNote);
    await linkedSubmission.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(linkedSubmission).toHaveCount(0);
    await expect
      .poll(async () => {
        const record = (
          await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
        ).data.data.evidence.find((item) => item.note === linkedNote);
        return { actionId: record?.actionId, status: record?.status };
      })
      .toEqual({ actionId: confirmationActionId, status: "pending" });
    await enter("student");
    await capture("employee-desktop");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await capture("employee-narrow");
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter("manager");
    await page.getByTestId(COMPETENCIES_HANDLES.TEAM).click();
    await expect(
      page.getByRole("heading", { name: "Needs Your Attention", exact: true }),
    ).toBeVisible();
    await capture("manager-overview");
    await page.getByRole("button", { name: "View All", exact: true }).click();
    await page.getByTestId(COMPETENCIES_HANDLES.MATRIX).click();
    await expect(page.getByRole("table", { name: "Matrix", exact: true })).toBeVisible();
    const profileSelector = page.getByRole("combobox", { name: "Job profile", exact: true });
    if (await profileSelector.isVisible()) {
      await profileSelector.click();
      await page.getByRole("option", { name: `Acceptance profile ${name}`, exact: true }).click();
    }
    await expect(page.getByRole("table", { name: "Matrix", exact: true })).toContainText(name);
    await capture("manager-matrix");
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await page.getByRole("button", { name: "Create plan", exact: true }).click();
    await selectPerson(page);
    await page.getByRole("combobox", { name: "Competency gap" }).click();
    await page.getByRole("option", { name: `${name} - Foundation`, exact: true }).click();
    const objective = `Practice clear workplace explanations - ${name}`;
    await page.getByLabel("Objective", { exact: true }).fill(objective);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await openPlanAction(page, objective);
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
    await enter("student");
    await page.setViewportSize({ width: 2222, height: 1912 });
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await expect(page.getByRole("heading", { level: 3 })).toHaveCount(2);
    await expect(page.getByRole("heading", { name: objective, exact: true })).toBeVisible();
    const planSummary = page.getByRole("heading", { name: objective, exact: true }).locator("..");
    await expect(page.locator("details, summary")).toHaveCount(0);
    await expect(planSummary).toContainText("Demonstrate a clear conversation");
    await expect(planSummary).not.toContainText("Planned");
    await capture("employee-plan-en-2222");
    await api.api.settingsControllerUpdateUserSettings({ language: "pl" });
    await page.reload();
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await expect(
      page.getByRole("heading", { name: "Mój plan rozwoju", exact: true }),
    ).toBeVisible();
    await capture("employee-plan-pl-2222");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await capture("employee-plan-pl-390");
    await api.api.settingsControllerUpdateUserSettings({ language: "en" });
    await page.reload();
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await expect(page.getByRole("heading", { name: objective, exact: true })).toBeVisible();
    await capture("employee-plan-en-390");
    await page.setViewportSize({ width: 1440, height: 900 });
    await enter("manager");
    const managerWorkspace = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data;
    const course = managerWorkspace.courses[0];
    expect(course, "The connected fixture needs an available published course").toBeTruthy();
    const courseObjective = `Learning assignment - ${name}`;
    const courseActionId = (
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "create_action",
        requestId: randomUUID(),
        value: {
          subjectId: tenant.people.student.id,
          competencyId,
          levelId: "foundation",
          kind: "course",
          courseId: course.id,
          ownerId: tenant.people.manager.id,
          objective: courseObjective,
          dueDate: null,
        },
      })
    ).data.data.id;
    await page.reload();
    await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
    await openPlanAction(page, courseObjective);
    await expect(
      page
        .getByTestId(COMPETENCIES_HANDLES.ACTION(courseActionId))
        .getByRole("button", { name: "Assign course", exact: true }),
    ).toHaveCount(0);
    await expect(
      api.api.competenciesControllerAssignCompetenciesLearning({
        id: courseActionId,
        subjectId: tenant.people.student.id,
        requestId: randomUUID(),
      }),
    ).rejects.toMatchObject({ response: { status: 403 } });
    await enter("admin");
    await api.api.competenciesControllerAssignCompetenciesLearning({
      id: courseActionId,
      subjectId: tenant.people.student.id,
      requestId: randomUUID(),
    });
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.actions.find((item) => item.id === courseActionId)?.assignmentStatus,
        { timeout: 30000 },
      )
      .toBe("confirmed");
    await enter("verifier");
    await expect(page.getByTestId(COMPETENCIES_HANDLES.CATALOG)).toHaveCount(0);
    const subject = await selectPerson(page);
    await expect(page.getByRole("heading", { name: subject.name, exact: true })).toBeVisible();
    await page.getByTestId(COMPETENCIES_HANDLES.REVIEW).click();
    let evidence = await findReviewEvidence(page, note);
    await evidence.getByRole("button", { name: "View details", exact: true }).click();
    await expect(page.getByRole("heading", { name: subject.name, exact: true })).toBeVisible();
    await page.getByTestId(COMPETENCIES_HANDLES.REVIEW).click();
    evidence = await findReviewEvidence(page, note);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      evidence.getByRole("button", { name: "Download attachment", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("conversation.pdf");
    await download.saveAs(testInfo.outputPath("conversation.pdf"));
    await evidence.getByRole("button", { name: "Approve", exact: true }).click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("The observed conversation meets the current condition.");
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    evidence = await findReviewEvidence(page, note, "review-history");
    await expect(evidence).toContainText("Approved");

    const linkedEvidence = await findReviewEvidence(page, linkedNote);
    await linkedEvidence.getByRole("button", { name: "Approve", exact: true }).click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("The follow-up document meets the condition.");
    await page.getByRole("dialog").getByRole("button", { name: "Approve", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByTestId(COMPETENCIES_HANDLES.OWN).click();
    await page.getByRole("combobox", { name: "Inspect competency", exact: true }).click();
    await page.getByRole("option", { name, exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm observation", exact: true })
      .click();
    const observation = page.getByRole("dialog", { name: "Confirm observation", exact: true });
    await observation
      .getByLabel("Note", { exact: true })
      .fill("Observed an independent conversation.");
    await observation.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(observation).toHaveCount(0);
    await capture("verifier");
    await enter("student");
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.standings.find((item) => item.standing.competencyId === competencyId)
            ?.standing.currentLevelId,
      )
      .toBe("foundation");
    const confirmedCompetency = page.getByTestId(COMPETENCIES_HANDLES.ROW(competencyId));
    await expect(confirmedCompetency).toContainText(name);
    await page.setViewportSize({ width: 2222, height: 1912 });
    await page.screenshot({
      path: testInfo.outputPath("employee-confirmed-overview.png"),
      clip: { x: 0, y: 0, width: 2222, height: 900 },
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await confirmedCompetency.getByRole("button", { name: "View details" }).click();
    await expect(page.getByRole("dialog")).toContainText("Foundation");
    await page.getByRole("dialog").press("Escape");
    await enter("verifier");
    await selectPerson(page);
    await page.getByRole("combobox", { name: "Inspect competency", exact: true }).click();
    await page.getByRole("option", { name, exact: true }).click();
    await page.getByRole("button", { name: "Revoke confirmation", exact: true }).click();
    await page
      .getByLabel("Reason", { exact: true })
      .fill("Qualification withdrawn after an external reassessment.");
    await page.getByRole("button", { name: "Revoke confirmation", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await enter("student");
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.standings.find((item) => item.standing.competencyId === competencyId)
            ?.standing,
      )
      .toMatchObject({ currentLevelId: null, attainedLevelId: "foundation" });
    await enter("admin");
    await page.getByTestId(COMPETENCIES_HANDLES.PEOPLE).click();
    await page.getByRole("combobox", { name: `Job profile: ${employee!.name}` }).click();
    await page.getByRole("option", { name: "No assigned profile" }).click();
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.subjects.find((item) => item.id === tenant.people.student.id)?.profileId,
      )
      .toBeNull();
    await api.api.competenciesControllerExecuteCompetenciesCommand({
      operation: "assign_profile",
      subjectId: tenant.people.student.id,
      profileId: originalProfileId,
    });
    profileAssigned = false;
    await page.getByTestId(COMPETENCIES_HANDLES.CATALOG).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await capture("administrator-catalog");
    await expect(page.getByRole("tab", { name: "Validation Rules", exact: true })).toHaveCount(0);
    await page.getByTestId(COMPETENCIES_HANDLES.PROFILES).click();
    await capture("administrator-profiles");
    await expect(page.getByRole("button", { name: "New profile" })).toBeVisible();
    await page.getByRole("button", { name: "New profile" }).click();
    await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill(`Profile for ${name}`);
    await page.getByRole("checkbox", { name, exact: true }).check();
    await expect(page.getByRole("combobox", { name: "Required level", exact: true })).toContainText(
      "Foundation",
    );
    await page.getByRole("dialog").press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    if (competencyId) {
      await authenticate("admin");
      const workspace = (
        await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
      ).data.data;
      const definition = workspace.catalog.find((item) => item.id === competencyId);
      if (profileAssigned)
        await api.api.competenciesControllerExecuteCompetenciesCommand({
          operation: "assign_profile",
          subjectId: tenant.people.student.id,
          profileId: originalProfileId,
        });
      for (const action of workspace.actions.filter(
        (item) => item.competencyId === competencyId && item.status !== "cancelled",
      ))
        await api.api.competenciesControllerExecuteCompetenciesCommand({
          operation: "update_action",
          id: action.id,
          subjectId: action.subjectId,
          version: action.version,
          objective: action.objective,
          ownerId: action.ownerId,
          dueDate: action.dueDate,
          status: "cancelled",
        });
      if (testProfileId) {
        const profile = workspace.profiles.find((item) => item.id === testProfileId)!;
        await api.api.competenciesControllerExecuteCompetenciesCommand({
          operation: "delete_profile",
          id: testProfileId,
          revision: profile.revision,
        });
      }
      if (definition && !definition.archived)
        await api.api.competenciesControllerExecuteCompetenciesCommand({
          operation: "archive_competency",
          id: definition.id,
          revision: definition.revision,
        });
    }
    for (const [role, language] of originalLanguages) {
      await authenticate(role);
      await api.api.settingsControllerUpdateUserSettings({ language });
    }
    await context.close();
  }
});

test("profiles save active requirements and delete from the editor", async ({
  browser,
}, testInfo) => {
  const tenant = fixture!;
  const context = await browser.newContext({ viewport: { width: 2222, height: 1912 } });
  const page = await context.newPage();
  const api = createFixtureApiClient();
  const ids: string[] = [];
  let profileId: string | undefined;
  let originalLanguage: SupportedLanguages | undefined;
  const name = `Profile editor ${randomUUID().slice(0, 8)}`;
  try {
    await authenticateContext(
      context,
      tenant.host,
      tenant.people.admin.email,
      process.env.COMPETENCIES_E2E_PASSWORD!,
    );
    await api.syncFromContext(context, tenant.host);
    originalLanguage = (await api.api.settingsControllerGetUserSettings()).data.data.language;
    await api.api.settingsControllerUpdateUserSettings({ language: "en" });
    for (let index = 0; index < 8; index++) {
      ids.push(
        (
          await api.api.competenciesControllerExecuteCompetenciesCommand({
            operation: "save_competency",
            value: {
              name: `${name} competency ${index}`,
              category: "",
              description: "",
              levels: [
                {
                  id: "foundation",
                  name: "Foundation",
                  conditions: [
                    {
                      id: "observation",
                      kind: "observation",
                      description: "Confirm the task",
                    },
                  ],
                },
              ],
            },
          })
        ).data.data.id,
      );
    }
    await page.goto(`${tenant.host}/competencies`);
    await page.getByTestId(COMPETENCIES_HANDLES.PROFILES).click();
    await page.getByRole("button", { name: "New profile", exact: true }).click();
    const dialog = page.getByRole("dialog");
    const requirements = dialog.getByRole("group", { name: "Required competencies", exact: true });
    await expect(requirements).toBeVisible();
    expect(
      await requirements.evaluate(
        (element) =>
          element.scrollHeight > element.clientHeight &&
          getComputedStyle(element).overflowY === "auto",
      ),
    ).toBe(true);
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await requirements.getByRole("checkbox", { name: `${name} competency 7`, exact: true }).check();
    await expect(
      requirements.getByRole("combobox", { name: "Required level", exact: true }),
    ).toContainText("Foundation");
    await page.screenshot({
      path: testInfo.outputPath("profile-editor-en.png"),
      animations: "disabled",
      clip: { x: 580, y: 380, width: 1060, height: 1180 },
    });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const row = page.getByRole("row").filter({ has: page.getByText(name, { exact: true }) });
    await expect(row.getByRole("button", { name: name, exact: true })).toHaveCount(0);
    const profile = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data.profiles.find((item) => item.name === name)!;
    profileId = profile.id;
    expect(profile.requirements).toEqual([{ competencyId: ids[7], levelId: "foundation" }]);
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeInViewport();
    await expect(dialog.getByRole("button", { name: "Delete", exact: true })).toBeInViewport();
    await page.screenshot({
      path: testInfo.outputPath("profile-editor-390.png"),
      fullPage: true,
      animations: "disabled",
    });
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(row).toHaveCount(0);
    profileId = undefined;
  } finally {
    const workspace = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data;
    const profile = workspace.profiles.find((item) => item.id === profileId || item.name === name);
    if (profile)
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "delete_profile",
        id: profile.id,
        revision: profile.revision,
      });
    for (const id of ids) {
      const definition = workspace.catalog.find((item) => item.id === id)!;
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "archive_competency",
        id,
        revision: definition.revision,
      });
    }
    if (originalLanguage)
      await api.api.settingsControllerUpdateUserSettings({ language: originalLanguage });
    await context.close();
  }
});

test("core account rename, archive and deletion retain plugin evidence, achievements and plans", async ({
  browser,
}) => {
  const tenant = fixture!;
  const password = process.env.COMPETENCIES_E2E_PASSWORD;
  expect(password).toBeTruthy();
  const context = await browser.newContext();
  const api = createFixtureApiClient();
  const users = new UserFactory(api);
  let subjectId: string | undefined;
  let competencyId: string | undefined;
  try {
    await authenticateContext(context, tenant.host, tenant.people.admin.email, password!);
    await api.syncFromContext(context, tenant.host);
    const subject = await users.create();
    subjectId = subject.id;
    competencyId = (
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "save_competency",
        value: {
          name: `Account lifecycle ${randomUUID().slice(0, 8)}`,
          category: "Interpersonal",
          description: "",
          levels: ["foundation", "independent"].map((id) => ({
            id,
            name: id,
            conditions: [
              {
                id,
                kind: "observation",
                description: `Demonstrate ${id}`,
                verifierIds: [tenant.people.admin.id],
              },
            ],
          })),
        },
      })
    ).data.data.id;
    const recognition = {
      requestId: randomUUID(),
      subjectId,
      competencyId,
      conditionIds: ["foundation"],
      kind: "recognition" as const,
      occurredAt: new Date(Date.now() - 1000).toISOString(),
      validUntil: null,
      note: "Verified prior qualification",
    };
    await api.api.competenciesControllerExecuteCompetenciesCommand({
      operation: "submit_evidence",
      value: recognition,
    });
    await api.api.competenciesControllerExecuteCompetenciesCommand({
      operation: "create_action",
      requestId: randomUUID(),
      value: {
        subjectId,
        competencyId,
        levelId: "independent",
        kind: "practice",
        objective: "Practice independently",
        ownerId: tenant.people.admin.id,
        dueDate: null,
      },
    });
    const read = async () =>
      (await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })).data.data;
    const readSubject = () =>
      api.api.competenciesControllerGetCompetenciesWorkspace({
        language: "en",
        subjectId: subject.id,
      });
    const before = await read();
    expect(
      before.standings.find(
        (item) => item.subjectId === subject.id && item.standing.competencyId === competencyId,
      )?.standing,
    ).toMatchObject({ currentLevelId: "foundation", attainedLevelId: "foundation" });
    const history = (workspace: typeof before) => ({
      evidence: workspace.evidence.filter((item) => item.subjectId === subject.id),
      evidenceHistory: workspace.evidenceHistory.filter((item) => item.subjectId === subject.id),
      awards: workspace.awardHistory.filter((item) => item.subjectId === subject.id),
      actions: workspace.actions.filter((item) => item.subjectId === subject.id),
      actionHistory: workspace.actionHistory.filter((item) => item.subjectId === subject.id),
    });
    await users.update(subjectId, { firstName: "Renamed", lastName: "Acceptance" });
    const renamed = await read();
    expect(renamed.people.find((person) => person.id === subjectId)?.name).toBe(
      "Renamed Acceptance",
    );
    expect(history(renamed)).toEqual(history(before));
    await users.update(subjectId, { archived: true });
    const archived = await read();
    await expect(readSubject()).rejects.toMatchObject({ response: { status: 400 } });
    expect(archived.people.find((person) => person.id === subjectId)).toMatchObject({
      archived: true,
      canPlan: false,
    });
    expect(history(archived)).toEqual(history(before));
    await expect(
      api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "submit_evidence",
        value: { ...recognition, requestId: randomUUID() },
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    await users.delete(subjectId);
    const deleted = await read();
    await expect(readSubject()).rejects.toMatchObject({ response: { status: 400 } });
    expect(deleted.people.some((person) => person.id === subjectId)).toBe(false);
    expect(history(deleted)).toEqual(history(before));
    expect(deleted.standings.filter((item) => item.subjectId === subject.id)).toEqual(
      before.standings.filter((item) => item.subjectId === subject.id),
    );
    await expect(
      api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "assign_profile",
        subjectId,
        profileId: null,
      }),
    ).rejects.toMatchObject({ response: { status: 400 } });
    subjectId = undefined;
  } finally {
    if (subjectId) await users.delete(subjectId);
    if (competencyId) {
      const workspace = (
        await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
      ).data.data;
      for (const action of workspace.actions.filter(
        (item) =>
          item.competencyId === competencyId &&
          workspace.people.some((person) => person.id === item.subjectId && !person.archived),
      ))
        await api.api.competenciesControllerExecuteCompetenciesCommand({
          operation: "update_action",
          id: action.id,
          subjectId: action.subjectId,
          version: action.version,
          objective: action.objective,
          ownerId: action.ownerId,
          dueDate: action.dueDate,
          status: "cancelled",
        });
      const definition = workspace.catalog.find((item) => item.id === competencyId)!;
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "archive_competency",
        id: competencyId,
        revision: definition.revision,
      });
    }
    await context.close();
  }
});

test("role workspaces follow the Polish and English reference layouts", async ({
  browser,
}, testInfo) => {
  test.setTimeout(120000);
  const tenant = fixture!;
  const password = process.env.COMPETENCIES_E2E_PASSWORD;
  expect(password).toBeTruthy();
  const roles = [
    {
      role: "student",
      titles: { en: "My Competencies", pl: "Moje kompetencje" },
      tabs: [COMPETENCIES_HANDLES.OWN, COMPETENCIES_HANDLES.DOCUMENTS, COMPETENCIES_HANDLES.PLANS],
    },
    {
      role: "manager",
      titles: { en: "Employees", pl: "Pracownicy" },
      tabs: [COMPETENCIES_HANDLES.TEAM, COMPETENCIES_HANDLES.MATRIX, COMPETENCIES_HANDLES.PLANS],
    },
    {
      role: "admin",
      titles: { en: "Competency Catalog", pl: "Katalog kompetencji" },
      tabs: [
        COMPETENCIES_HANDLES.CATALOG,
        COMPETENCIES_HANDLES.PROFILES,
        COMPETENCIES_HANDLES.SETTINGS,
      ],
    },
    {
      role: "verifier",
      titles: { en: "My Competencies", pl: "Moje kompetencje" },
      tabs: [COMPETENCIES_HANDLES.OWN, COMPETENCIES_HANDLES.REVIEW, COMPETENCIES_HANDLES.PLANS],
    },
  ] as const;
  for (const { role, titles, tabs } of roles) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 956 } });
    const page = await context.newPage();
    const api = createFixtureApiClient();
    await authenticateContext(context, tenant.host, tenant.people[role].email, password!);
    await api.syncFromContext(context, tenant.host);
    const settings = (await api.api.settingsControllerGetUserSettings()).data.data;
    expect(settings.isMFAEnabled, "Use disposable accounts without MFA").toBe(false);
    try {
      for (const language of ["en", "pl"] as const) {
        await api.api.settingsControllerUpdateUserSettings({ language });
        await page.goto(`${tenant.host}/competencies`);
        await expect(
          page.getByRole("heading", { name: titles[language], exact: true, level: 1 }),
        ).toBeVisible();
        const menuLabel = { en: "Competencies", pl: "Kompetencje" }[language];
        await expect(
          page.getByRole("link", { name: menuLabel, exact: true }).first(),
        ).toBeVisible();
        for (const tab of tabs) {
          await page.getByTestId(tab).click();
          await expect(page.getByTestId(tab)).toHaveAttribute("aria-selected", "true");
          await expect(page.getByTestId(COMPETENCIES_HANDLES.PAGE)).toBeVisible();
          const breadcrumbs = page.locator(".breadcrumbs");
          await expect(breadcrumbs.getByRole("link")).toHaveCount(3);
          await expect(breadcrumbs.getByRole("link").first()).toHaveText("Mentingo");
          await expect(breadcrumbs.getByRole("link").last()).toHaveText(
            await page
              .getByTestId(COMPETENCIES_HANDLES.PAGE)
              .getByRole("heading", { level: 1 })
              .innerText(),
          );
          if (tab === COMPETENCIES_HANDLES.PLANS && role === "student") {
            const point = page.getByRole("tabpanel").locator("section > div:has(> h3)").first();
            if (await point.count()) {
              await expect(point.locator(":scope > *")).toHaveCount(2);
              await expect(point.getByRole("button")).toHaveCount(0);
            }
            await page.setViewportSize({ width: 2222, height: 1912 });
            await page.screenshot({
              path: testInfo.outputPath(`employee-plan-${language}-two-lines.png`),
              clip: { x: 0, y: 0, width: 2222, height: 600 },
            });
            await page.setViewportSize({ width: 390, height: 844 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({
              path: testInfo.outputPath(`employee-plan-${language}-390.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 1440, height: 956 });
          }
          if (tab === COMPETENCIES_HANDLES.PROFILES && role === "admin") {
            const title = page
              .getByTestId(COMPETENCIES_HANDLES.PAGE)
              .getByRole("heading", { level: 1 });
            const buttonName = language === "en" ? "New profile" : "Nowy profil";
            const header = title.locator("..").locator("..");
            await expect(
              header.getByRole("button", { name: buttonName, exact: true }),
            ).toBeVisible();
            await expect(
              page.getByRole("heading", { name: await title.innerText(), exact: true }),
            ).toHaveCount(1);
            const table = page.getByRole("table", {
              name: language === "en" ? "Job Profiles" : "Profile stanowisk",
              exact: true,
            });
            await expect(table.locator("tbody p")).toHaveCount(0);
            await expect(table.getByRole("columnheader")).toHaveCount(4);
            await page.setViewportSize({ width: 2222, height: 1912 });
            await page.screenshot({
              path: testInfo.outputPath(`profiles-${language}-header.png`),
              clip: { x: 0, y: 0, width: 2222, height: 1000 },
            });
            await header.getByRole("button", { name: buttonName, exact: true }).click();
            await expect(
              page
                .getByRole("dialog")
                .getByLabel(language === "en" ? "Name" : "Nazwa", { exact: true }),
            ).toHaveValue("");
            await expect(
              page.getByRole("dialog").getByRole("group", {
                name: language === "en" ? "Required competencies" : "Wymagane kompetencje",
                exact: true,
              }),
            ).toBeVisible();
            await expect(
              page
                .getByRole("dialog")
                .getByRole("button", { name: language === "en" ? "Save" : "Zapisz", exact: true }),
            ).toBeVisible();
            await page.screenshot({
              path: testInfo.outputPath(`profiles-editor-${language}.png`),
              animations: "disabled",
              clip: { x: 580, y: 380, width: 1060, height: 1180 },
            });
            await page.setViewportSize({ width: 390, height: 844 });
            await expect(
              page
                .getByRole("dialog")
                .getByRole("button", { name: language === "en" ? "Save" : "Zapisz", exact: true }),
            ).toBeInViewport();
            await page.screenshot({
              path: testInfo.outputPath(`profiles-editor-${language}-390.png`),
              animations: "disabled",
              fullPage: true,
            });
            await page.setViewportSize({ width: 2222, height: 1912 });
            await page
              .getByRole("dialog")
              .getByRole("button", { name: language === "en" ? "Cancel" : "Anuluj", exact: true })
              .click();
            await page.setViewportSize({ width: 390, height: 844 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({
              path: testInfo.outputPath(`profiles-${language}-390.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 1440, height: 956 });
          }
          if (tab === COMPETENCIES_HANDLES.PLANS && role === "manager") {
            await page.setViewportSize({ width: 2222, height: 1912 });
            await page.screenshot({
              path: testInfo.outputPath(`plans-${language}-header.png`),
              clip: { x: 0, y: 0, width: 2222, height: 720 },
            });
            await page.setViewportSize({ width: 390, height: 844 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({
              path: testInfo.outputPath(`plans-${language}-390.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 1440, height: 956 });
          }
          if (tab === COMPETENCIES_HANDLES.OWN && role === "student") {
            await expect(page.getByRole("combobox")).toHaveCount(0);
            await expect(
              page.getByRole("heading", {
                name: language === "en" ? /^Your next step/ : /^Twój następny krok/,
              }),
            ).toBeVisible();
            await expect(
              page.getByRole("button", {
                name: language === "en" ? "View details" : "Zobacz szczegóły",
                exact: true,
              }),
            ).toBeVisible();
            await expect(
              page.getByRole("heading", {
                name: language === "en" ? "Confirmed" : "Potwierdzone",
                exact: true,
              }),
            ).toBeVisible();
            const currentWorkspace = (
              await api.api.competenciesControllerGetCompetenciesWorkspace({ language })
            ).data.data;
            const requirements = currentWorkspace.assessments.find(
              (item) => item.subjectId === tenant.people.student.id,
            )?.requirements;
            const confirmed = currentWorkspace.standings.filter(({ subjectId, standing }) => {
              const requirement = requirements?.find(
                (item) => item.requirement.competencyId === standing.competencyId,
              );
              return (
                subjectId === tenant.people.student.id &&
                standing.currentLevelId &&
                !standing.expiring &&
                (requirement?.met ?? true)
              );
            });
            const confirmedSection = page
              .getByRole("heading", {
                name: language === "en" ? "Confirmed" : "Potwierdzone",
                exact: true,
              })
              .locator("..")
              .locator("..");
            if (confirmed.length) {
              for (const { standing } of confirmed)
                await expect(
                  confirmedSection.getByTestId(COMPETENCIES_HANDLES.ROW(standing.competencyId)),
                ).toBeVisible();
            } else {
              await expect(
                confirmedSection.getByText(
                  language === "en"
                    ? "No competencies have been confirmed at the required level yet."
                    : "Nie ma jeszcze kompetencji potwierdzonych na wymaganym poziomie.",
                  { exact: true },
                ),
              ).toBeVisible();
            }
            const expiring = currentWorkspace.standings.filter(
              (item) => item.subjectId === tenant.people.student.id && item.standing.expiring,
            );
            if (expiring.length) {
              await expect(page.getByRole("complementary").getByRole("button")).toHaveCount(
                expiring.length,
              );
            } else {
              await expect(
                page.getByText(
                  language === "en"
                    ? "No competency confirmations are expiring soon."
                    : "Żadne potwierdzenia kompetencji nie wygasają wkrótce.",
                  { exact: true },
                ),
              ).toBeVisible();
            }
            await expect(
              page.getByText(language === "en" ? "Achievement history" : "Historia osiągnięć", {
                exact: true,
              }),
            ).toHaveCount(0);
            const overview = page.getByRole("table", {
              name: language === "en" ? "Competencies" : "Kompetencje",
              exact: true,
            });
            await expect(overview.getByRole("columnheader")).toHaveText(
              language === "en"
                ? ["Competency", "Your / Required", "Latest evidence", "What next"]
                : ["Kompetencja", "Twój / wymagany", "Ostatni dowód", "Co dalej"],
            );
            const attention =
              requirements?.filter((item) => !item.met || item.standing.expiring) ?? [];
            await expect(overview.getByRole("row")).toHaveCount(attention.length + 1);
            for (const value of await overview
              .locator("tbody tr td:nth-child(2)")
              .allTextContents())
              expect(value).toMatch(/\/ L\d+$/);
            await expect(page.getByRole("progressbar")).toHaveCount(0);
            await page.setViewportSize({ width: 2222, height: 1912 });
            const main = await overview.locator("..").locator("..").boundingBox();
            const sidebar = await page.getByRole("complementary").last().boundingBox();
            expect(main!.width / sidebar!.width).toBeGreaterThan(1.6);
            expect(main!.width / sidebar!.width).toBeLessThan(2);
            await page.screenshot({
              path: testInfo.outputPath(`employee-${language}-overview.png`),
              clip: { x: 0, y: 0, width: 2222, height: 850 },
            });
            await page.setViewportSize({ width: 390, height: 844 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await expect(
              page.getByRole("heading", {
                name: language === "en" ? "What Does Your Status Mean?" : "Co oznacza Twój status?",
                exact: true,
              }),
            ).toBeVisible();
            await page.screenshot({
              path: testInfo.outputPath(`employee-${language}-390.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 1440, height: 956 });
          }
          if (tab === COMPETENCIES_HANDLES.MATRIX) {
            await page.setViewportSize({ width: 2222, height: 1912 });
            const matrix = page.getByRole("table", {
              name: language === "en" ? "Matrix" : "Matryca",
              exact: true,
            });
            await expect(matrix).toBeVisible();
            const section = page.locator("section").filter({ has: matrix });
            const search = page.getByRole("textbox", {
              name: language === "en" ? "Find person" : "Znajdź osobę",
              exact: true,
            });
            const legend = page.getByLabel(
              language === "en" ? "Status legend" : "Legenda statusów",
              { exact: true },
            );
            const profileSelector = section.getByRole("combobox");
            const multipleProfiles = (await profileSelector.count()) > 0;
            let selectedProfileName: string;
            if (multipleProfiles) {
              await expect(profileSelector).toBeVisible();
              selectedProfileName = await profileSelector.innerText();
            } else {
              await expect(section.getByRole("heading", { level: 2 })).toBeVisible();
              selectedProfileName = await section.getByRole("heading", { level: 2 }).innerText();
            }
            await expect(section.getByRole("textbox")).toHaveCount(0);
            const legendBounds = (await legend.boundingBox())!;
            const sectionBounds = (await section.boundingBox())!;
            const searchBounds = (await search.boundingBox())!;
            expect(legendBounds.y + legendBounds.height).toBeLessThan(sectionBounds.y);
            expect(legendBounds.x).toBeGreaterThan(searchBounds.x + searchBounds.width);
            const matrixWorkspace = (
              await api.api.competenciesControllerGetCompetenciesWorkspace({
                language,
                teamOnly: "true",
              })
            ).data.data;
            const selectedProfile = matrixWorkspace.publishedProfiles.find(
              (profile) => profile.name === selectedProfileName,
            );
            expect(selectedProfile).toBeTruthy();
            await expect(matrix.getByRole("columnheader")).toHaveCount(
              selectedProfile!.requirements.length + 1,
            );
            const personHeader = (await matrix.getByRole("columnheader").first().boundingBox())!;
            expect(personHeader.width).toBeLessThanOrEqual(260);
            await expect(matrix.getByRole("columnheader").nth(1)).not.toContainText(
              /Required level|Wymagany poziom/,
            );
            const tile = matrix.getByRole("img").first();
            await expect(tile).toContainText(/L\d+/);
            await expect(tile).not.toContainText(/None|Brak/);
            const marker = await tile.locator("span[aria-hidden=true]").evaluate((element) => ({
              background: getComputedStyle(element).backgroundColor,
              border: getComputedStyle(element).borderTopWidth,
              borderColor: getComputedStyle(element).borderTopColor,
              color: getComputedStyle(element).color,
            }));
            expect(marker.border).toBe("2px");
            expect(marker.borderColor).toBe("rgb(252, 252, 252)");
            expect(marker.color).toBe("rgb(252, 252, 252)");
            expect(marker.background).not.toBe("rgba(0, 0, 0, 0)");
            const trigger = matrix
              .getByRole("button", {
                name: (await tile.getAttribute("aria-label"))!,
                exact: true,
              })
              .first();
            await trigger.hover();
            const requiredLevel = (await tile.innerText()).match(/L\d+/)![0];
            await expect(page.getByRole("tooltip")).toHaveText(
              new RegExp(
                language === "en"
                  ? `^(Level met|Competency gap|Confirmation expiring) · ${requiredLevel}$`
                  : `^(Poziom spełniony|Luka kompetencyjna|Ważność wygasa) · ${requiredLevel}$`,
              ),
            );
            if (!multipleProfiles) {
              expect(
                await section
                  .getByRole("heading", { level: 2 })
                  .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
              ).toBeGreaterThanOrEqual(20);
            }
            await page.screenshot({
              path: testInfo.outputPath(`matrix-${language}-tooltip-2222.png`),
              clip: { x: 0, y: 0, width: 2222, height: 720 },
            });
            await page.mouse.move(0, 0);
            await search.focus();
            await trigger.focus();
            await expect(page.getByRole("tooltip")).toBeVisible();
            await search.focus();

            await expect(matrix.getByRole("progressbar")).toHaveCount(0);
            await search.fill("nobody-matches-this-name");
            await page.screenshot({
              path: testInfo.outputPath(`matrix-${language}-2222.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 390, height: 844 });
            expect(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            await page.screenshot({
              path: testInfo.outputPath(`matrix-${language}-390.png`),
              fullPage: true,
            });
            await page.setViewportSize({ width: 1440, height: 956 });
          }
          await page.screenshot({
            path: testInfo.outputPath(`${role}-${language}-${tab}.png`),
            fullPage: true,
          });
        }
        await page.getByTestId(tabs[0]).click();
        if (role === "manager") {
          await page.getByTestId(COMPETENCIES_HANDLES.PLANS).click();
          await expect(
            page.getByRole("combobox", {
              name: language === "en" ? "Person" : "Pracownik",
              exact: true,
            }),
          ).toHaveCount(0);
          await expect(
            page.getByRole("button", {
              name: language === "en" ? "Add development action" : "Dodaj działanie rozwojowe",
              exact: true,
            }),
          ).toHaveCount(0);
          const createPlan = page.getByRole("button", {
            name: language === "en" ? "Create plan" : "Utwórz plan",
            exact: true,
          });
          await expect(createPlan).toBeVisible();
          const createBounds = (await createPlan.boundingBox())!;
          const tabsBounds = (await page
            .getByRole("tablist", {
              name: language === "en" ? "Competencies" : "Kompetencje",
              exact: true,
            })
            .boundingBox())!;
          expect(createBounds.y + createBounds.height).toBeLessThan(tabsBounds.y);
          await createPlan.click();
          const dialog = page.getByRole("dialog");
          await expect(
            dialog.getByRole("combobox", {
              name: language === "en" ? "Person" : "Pracownik",
              exact: true,
            }),
          ).toBeVisible();
          await expect(
            dialog.getByRole("button", {
              name: language === "en" ? "Save" : "Zapisz",
              exact: true,
            }),
          ).toBeDisabled();
          await page.keyboard.press("Escape");
          await page.getByTestId(COMPETENCIES_HANDLES.TEAM).click();
          const gaps = page.getByRole("button", {
            name: language === "en" ? /^Not confirmed/ : /^Niepotwierdzone/,
          });
          const normalColor = await gaps.evaluate(
            (element) => getComputedStyle(element).backgroundColor,
          );
          await gaps.hover();
          await expect
            .poll(() => gaps.evaluate((element) => getComputedStyle(element).backgroundColor))
            .not.toBe(normalColor);
          await gaps.focus();
          await page.keyboard.press("Enter");
          await expect(page.getByTestId(COMPETENCIES_HANDLES.MATRIX)).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await page.getByTestId(COMPETENCIES_HANDLES.TEAM).click();
          await page
            .getByRole("button", {
              name:
                language === "en"
                  ? /^(Expiring|Expires in \d+ days)/
                  : /^(Wkrótce wygasa|Wygasa w \d+ dni)/,
            })
            .click();
          await expect(page.getByTestId(COMPETENCIES_HANDLES.PLANS)).toHaveAttribute(
            "aria-selected",
            "true",
          );
          await page.getByTestId(COMPETENCIES_HANDLES.TEAM).click();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: testInfo.outputPath(`${role}-${language}-narrow.png`),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1440, height: 956 });
      }
    } finally {
      await api.api.settingsControllerUpdateUserSettings({ language: settings.language });
      await context.close();
    }
  }
});

test("administrator catalog cards edit definitions, verifiers and archive in one dialog", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90000);
  const tenant = fixture!;
  const context = await browser.newContext({ viewport: { width: 2222, height: 1912 } });
  const page = await context.newPage();
  const api = createFixtureApiClient();
  await authenticateContext(
    context,
    tenant.host,
    tenant.people.admin.email,
    process.env.COMPETENCIES_E2E_PASSWORD!,
  );
  await api.syncFromContext(context, tenant.host);
  const settings = (await api.api.settingsControllerGetUserSettings()).data.data;
  let id: string | undefined;
  const name = `Catalog acceptance ${randomUUID().slice(0, 8)}`;
  try {
    await api.api.settingsControllerUpdateUserSettings({ language: "en" });
    await page.goto(`${tenant.host}/competencies`);
    await expect(page.getByTestId(COMPETENCIES_HANDLES.CATALOG)).toBeVisible();
    await expect(page.getByRole("button", { name: "Team Competencies", exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByRole("checkbox", { name: "Archived", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Catalog", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Add competency", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("button", { name: "Archive", exact: true })).toHaveCount(0);
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByLabel("Category", { exact: true }).fill("Interpersonal");
    await dialog
      .getByLabel("Description", { exact: true })
      .fill("Explain a workplace task clearly.");
    const workspace = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data;
    const verifier = workspace.people.find((person) => person.id === tenant.people.verifier.id)!;
    await dialog.getByRole("button", { name: "Add level", exact: true }).click();
    await dialog.getByLabel("Level name", { exact: true }).fill("Foundation");
    await dialog.getByRole("button", { name: "Add condition", exact: true }).click();
    await dialog
      .getByLabel("Condition description", { exact: true })
      .fill("Demonstrate a clear explanation");
    for (const kind of ["Course", "Quiz", "AI Mentor assessment"]) {
      await dialog.getByRole("combobox", { name: "Condition type", exact: true }).click();
      await page.getByRole("option", { name: kind, exact: true }).click();
      await expect(dialog.getByPlaceholder("Verifiers", { exact: true })).toHaveCount(0);
      if (kind === "AI Mentor assessment")
        await page.screenshot({
          path: testInfo.outputPath("automatic-ai-condition.png"),
          animations: "disabled",
        });
    }
    await dialog.getByRole("combobox", { name: "Condition type", exact: true }).click();
    await page.getByRole("option", { name: "Observation", exact: true }).click();
    await dialog.getByPlaceholder("Verifiers", { exact: true }).fill(verifier.name);
    await dialog.getByRole("option", { name: verifier.name, exact: true }).click();
    await dialog.getByLabel("Name", { exact: true }).click();
    const rowGeometry = await dialog.getByRole("tabpanel").evaluate((element) => {
      const kind = element.querySelector('[role="combobox"]')!.getBoundingClientRect();
      const description = element
        .querySelector('input[id$="-description"]')!
        .getBoundingClientRect();
      return {
        difference: Math.abs(kind.top - description.top),
        heights: Math.abs(kind.height - description.height),
      };
    });
    expect(rowGeometry.difference).toBeLessThan(1);
    expect(rowGeometry.heights).toBeLessThan(1);

    await dialog.getByRole("button", { name: "Add level", exact: true }).click();
    await dialog.getByRole("tab", { name: "Level 1", exact: true }).click();
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByRole("tab", { name: "Level 2", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await dialog
      .getByRole("tabpanel")
      .getByLabel("Level name", { exact: true })
      .fill("Independent");
    await dialog.getByRole("button", { name: "Add condition", exact: true }).click();
    await dialog
      .getByRole("tabpanel")
      .getByRole("combobox", { name: "Condition type", exact: true })
      .click();
    await page.getByRole("option", { name: "Document", exact: true }).click();
    await dialog
      .getByRole("tabpanel")
      .getByLabel("Condition description", { exact: true })
      .fill("Provide the task checklist");
    const administrator = workspace.people.find((person) => person.id === tenant.people.admin.id)!;
    await dialog
      .getByRole("tabpanel")
      .getByPlaceholder("Verifiers", { exact: true })
      .fill(administrator.name);
    await dialog.getByRole("option", { name: administrator.name, exact: true }).click();
    await dialog.getByLabel("Name", { exact: true }).click();
    await dialog.getByRole("tab", { name: "Level 1", exact: true }).click();
    await expect(
      dialog.getByRole("tabpanel").getByLabel("Condition description", { exact: true }),
    ).toHaveValue("Demonstrate a clear explanation");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(async () => {
        const result = (
          await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
        ).data.data;
        id = result.catalog.find((item) => item.name === name)?.id;
        return result.catalog
          .find((item) => item.id === id)
          ?.levels.map((level) =>
            level.conditions.map((condition) => ({
              verifierIds: condition.verifierIds,
            })),
          );
      })
      .toEqual([
        [{ verifierIds: [tenant.people.verifier.id] }],
        [{ verifierIds: [tenant.people.admin.id] }],
      ]);
    const card = page.getByTestId(COMPETENCIES_HANDLES.CATALOG_CARD(id!));
    await expect(card).toContainText("Max level L2");
    await expect(card).toContainText("Interpersonal");
    await expect(card.locator("svg")).toHaveCount(0);
    await card.hover();
    await page.screenshot({
      path: testInfo.outputPath("catalog-en-desktop.png"),
      clip: { x: 0, y: 0, width: 2222, height: 900 },
    });
    await card.focus();
    await card.press("Enter");
    await expect(dialog).toHaveAccessibleName("Edit competency");
    await expect(dialog.getByText(verifier.name, { exact: true })).toBeVisible();
    await dialog.getByLabel("Name", { exact: true }).fill(`${name} edited`);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toHaveAccessibleName(`${name} edited`);
    await api.api.settingsControllerUpdateUserSettings({ language: "pl" });
    await page.reload();
    await expect(card).toContainText("Poziom maks. L2");
    await page.screenshot({
      path: testInfo.outputPath("catalog-pl-desktop.png"),
      clip: { x: 0, y: 0, width: 2222, height: 900 },
    });
    await card.click();
    await expect(dialog).toHaveAccessibleName("Edytuj kompetencję");
    await expect(dialog.getByRole("tab", { name: "Poziom 1", exact: true })).toBeVisible();
    await expect(dialog.getByRole("tab", { name: "Poziom 2", exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("catalog-editor-pl-desktop.png"),
      animations: "disabled",
      fullPage: false,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(dialog.getByRole("button", { name: "Zapisz", exact: true })).toBeInViewport();
    await expect
      .poll(() =>
        dialog.evaluate((element) => {
          const form = element.querySelector("form")!;
          const body = form.firstElementChild!.getBoundingClientRect();
          const footer = form.lastElementChild!.getBoundingClientRect();
          return body.bottom <= footer.top + 1;
        }),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath("catalog-editor-pl-mobile.png"),
      animations: "disabled",
      fullPage: false,
    });
    await dialog.getByRole("button", { name: "Anuluj", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("catalog-pl-mobile.png"), fullPage: true });
    await card.click();
    await dialog.getByRole("button", { name: "Archiwizuj", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await expect
      .poll(
        async () =>
          (
            await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
          ).data.data.catalog.find((item) => item.id === id)?.archived,
      )
      .toBe(true);
  } finally {
    const workspace = (
      await api.api.competenciesControllerGetCompetenciesWorkspace({ language: "en" })
    ).data.data;
    const definition = workspace.catalog.find(
      (item) => item.id === id || item.name === name || item.name === `${name} edited`,
    );
    if (definition && !definition.archived)
      await api.api.competenciesControllerExecuteCompetenciesCommand({
        operation: "archive_competency",
        id: definition.id,
        revision: definition.revision,
      });
    await api.api.settingsControllerUpdateUserSettings({ language: settings.language });
    await context.close();
  }
});
