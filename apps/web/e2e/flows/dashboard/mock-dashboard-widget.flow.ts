import type { Page, Route } from "@playwright/test";

type DashboardWidgetMockResponse = {
  path: string;
  body: unknown;
  method?: "GET" | "POST";
  query?: Record<string, string>;
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
  const canonicalWidgetType = (() => {
    const mapping: Record<string, string> = {
      a_event_calendar: "event_calendar",
      s_event_calendar: "event_calendar",
      a_training_completion: "training_completion",
      a_deadline_risks: "deadline_risks",
      s_continue_learning: "continue_learning",
      s_required_course: "required_courses",
      s_course_completion: "course_completion",
      s_certificates: "certificates",
      s_ai_mentor_practice: "ai_mentor_practice",
    };
    return mapping[widgetId] ?? widgetId;
  })();
  const semanticLayout =
    canonicalWidgetType === "event_calendar"
      ? { size: "4x2", allowedSizes: ["4x2", "4x3"], defaultSize: "4x2" }
      : canonicalWidgetType === "deadline_risks"
        ? { size: "2x1", allowedSizes: ["2x1", "2x2", "3x2"], defaultSize: "2x1" }
        : { size: "2x1", allowedSizes: ["2x1", "2x2"], defaultSize: "2x1" };

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

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
      await fulfillJson(route, {
        layout: {
          schemaVersion: 2,
          revision: 0,
          widgets: [{ type: canonicalWidgetType, size: semanticLayout.size, visible: true }],
        },
        catalog: [{ type: canonicalWidgetType, ...semanticLayout }],
      });
      return;
    }

    const response = responses.find(
      (candidate) =>
        candidate.path === path &&
        (candidate.method ?? "GET") === request.method() &&
        Object.entries(candidate.query ?? {}).every(
          ([key, value]) => url.searchParams.get(key) === value,
        ),
    );

    if (response) {
      await fulfillJson(route, response.body);
      return;
    }

    await route.continue();
  });
}
