import { USER_ROLE } from "~/config/userRoles";

import { AI_CONVERSATIONS_HANDLES as HANDLES } from "../../data/ai-conversations/handles";
import { expect, test } from "../../fixtures/test.fixture";

import type { Page } from "@playwright/test";

const THREAD_ID = "f6731652-8121-49d6-8d1c-dfe71e8ae515";
const conversation = {
  id: THREAD_ID,
  type: "practice",
  practiceSessionId: "5b02b66d-16e4-45ba-93aa-35241e4f1fd3",
  aiMentorLessonId: null,
  lessonId: null,
  courseId: null,
  courseTitle: null,
  title: "Historical interview",
  openingPreview: "Welcome to the saved interview.",
  owner: {
    id: "722f08f5-e085-43d7-a6e7-60599dd4038c",
    firstName: "Alex",
    lastName: "Learner",
    profilePictureUrl: null,
  },
  status: "archived",
  language: "en",
  createdAt: "2026-09-01T10:00:00.000Z",
  lastActivityAt: "2026-09-01T10:05:00.000Z",
};

async function mockConversations(page: Page) {
  const mutations: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/(?:admin\/ai-threads|ai\/)/.test(request.url()) && request.method() !== "GET")
      mutations.push(request.url());
  });
  await page.route(/\/api\/admin\/ai-threads(?:\/|\?|$)/, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") || 1);
    if (url.pathname.endsWith("/messages")) {
      const content = pageNumber === 1 ? "Saved learner answer" : "Saved mentor feedback";
      return route.fulfill({
        json: {
          data: [
            {
              id: `message-${pageNumber}`,
              role: pageNumber === 1 ? "user" : "assistant",
              content,
              createdAt: conversation.lastActivityAt,
            },
          ],
          pagination: { page: pageNumber, perPage: 100, totalItems: 101 },
        },
      });
    }
    if (url.pathname.endsWith(THREAD_ID))
      return route.fulfill({
        json: {
          data: {
            ...conversation,
            evaluation: {
              passed: true,
              score: 8,
              maxScore: 10,
              percentage: 80,
              criteria: [],
              blockingErrors: [],
            },
          },
        },
      });
    return route.fulfill({
      json: { data: [conversation], pagination: { page: pageNumber, perPage: 20, totalItems: 21 } },
    });
  });
  return mutations;
}

test("admin browses paginated saved history and evaluation without conversation mutations", async ({
  withReadonlyPage,
}, testInfo) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const mutations = await mockConversations(page);
    await page.goto("/admin/ai-conversations?status=archived&search=Historical&page=2");
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
    await expect(page.getByTestId(HANDLES.LIST).getByRole("img")).toHaveCount(0);
    await page.getByTestId(HANDLES.row(THREAD_ID)).click();
    await expect(page).toHaveURL(
      new RegExp(`${THREAD_ID}\\?status=archived&search=Historical&page=2`),
    );
    await expect(page.getByTestId(HANDLES.MESSAGE)).toContainText("Saved learner answer");
    await expect(page.getByRole("button", { name: "Refresh" })).toHaveCount(0);
    await expect(page.getByTestId(HANDLES.LIST)).toBeVisible();
    await expect(page.getByTestId(HANDLES.row(THREAD_ID))).toHaveAttribute("aria-current", "page");
    await page.getByTestId(HANDLES.LOAD_MORE).click();
    await expect(page.getByTestId(HANDLES.MESSAGE)).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true });
    await page.getByRole("tab", { name: "Details", exact: true }).click();
    await expect(page.getByRole("tabpanel", { name: "Details" })).toBeVisible();
    await page.getByTestId(HANDLES.RESULT).click();
    await expect(page.getByRole("dialog")).toContainText("8");
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId(HANDLES.LIST)).toBeHidden();
    await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
    await page.getByTestId(HANDLES.BACK).click();
    await expect(page).toHaveURL(/ai-conversations\?status=archived&search=Historical&page=2$/);
    await expect(page.getByTestId(HANDLES.LIST)).toBeVisible();
    await page.getByTestId(HANDLES.SEARCH).fill("Another title");
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(new RegExp(THREAD_ID));
    expect(mutations).toEqual([]);
  });
});

test("admin sees an unavailable transcript and can return to the list", async ({
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    await mockConversations(page);
    await page.route(new RegExp(`/api/admin/ai-threads/${THREAD_ID}(?:\\?|$)`), (route) =>
      route.fulfill({ status: 404, json: { message: "Not found" } }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/admin/ai-conversations/${THREAD_ID}`);
    await expect(page.getByTestId(HANDLES.READER).getByRole("alert")).toBeVisible();
    await page.getByTestId(HANDLES.BACK).click();
    await expect(page.getByTestId(HANDLES.row(THREAD_ID))).toBeVisible();
  });
});
