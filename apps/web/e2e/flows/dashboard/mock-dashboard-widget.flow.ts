import type { Page, Route } from "@playwright/test";

type DashboardWidgetMockResponse = {
  path: string;
  body: unknown;
  method?: "GET" | "POST";
};

const fulfillJson = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: body }),
  });
};

export async function mockDashboardWidget(
  page: Page,
  widgetId: string,
  responses: DashboardWidgetMockResponse[],
) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === "GET" && path === "/api/settings") {
      await fulfillJson(route, {
        language: "en",
        isMFAEnabled: false,
        MFASecret: null,
        dashboard: {
          widgets: [{ id: widgetId, order: 0, width: 2 }],
        },
      });
      return;
    }

    if (request.method() === "GET" && path === "/api/settings/dashboard") {
      await fulfillJson(route, [widgetId]);
      return;
    }

    const response = responses.find(
      (candidate) =>
        candidate.path === path && (candidate.method ?? "GET") === request.method(),
    );

    if (response) {
      await fulfillJson(route, response.body);
      return;
    }

    await route.continue();
  });
}
