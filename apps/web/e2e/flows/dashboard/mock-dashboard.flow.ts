import { DASHBOARD_SCHEMA_VERSION, DASHBOARD_WIDGET_CATALOG } from "@repo/shared";

import type { Page, Request, Route } from "@playwright/test";
import type { DashboardLayoutWidget, DashboardWidgetType } from "@repo/shared";

type DashboardMockRequest = { request: Request; url: URL };

export type DashboardMockResponse = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Exact pathname, or a pattern for id-based paths. */
  path: string | RegExp;
  status?: number;
  /** Full JSON body (BaseResponse endpoints wrap their payload in `data`). */
  body?: unknown;
  /** Computes the body per request, for paginated or stateful endpoints. */
  respond?: (request: DashboardMockRequest) => unknown;
};

type MockDashboardOptions = {
  widgets: DashboardLayoutWidget[];
  /** Widget types offered in the widget picker; defaults to the layout's widgets. */
  catalog?: DashboardWidgetType[];
  /** Layout returned by "Restore default"; defaults to `widgets`. */
  resetWidgets?: DashboardLayoutWidget[];
  responses?: DashboardMockResponse[];
};

const EMPTY_PAGE = { data: [], pagination: { totalItems: 0, page: 1, perPage: 10 } };

/** Widget endpoints answered with empty data unless a test response overrides them. */
const EMPTY_WIDGET_RESPONSES: DashboardMockResponse[] = [
  { path: "/api/ai/practice/today", body: { data: null } },
  { path: "/api/calendar/dashboard/events", body: { data: [] } },
  {
    path: "/api/course/dashboard-summary",
    body: {
      data: {
        continueLearningCourses: [],
        requiredCourses: [],
        completion: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentage: 0 },
      },
    },
  },
  {
    path: "/api/statistics/dashboard/training-completion",
    body: { data: { completed: 0, inProgress: 0, notStarted: 0, total: 0, percentage: 0 } },
  },
  { path: "/api/statistics/dashboard/deadline-risks/courses", body: EMPTY_PAGE },
  { path: "/api/certificates/dashboard", body: EMPTY_PAGE },
  { path: "/api/todo-tasks", body: EMPTY_PAGE },
];

const copyWidgets = (widgets: DashboardLayoutWidget[]) => widgets.map((widget) => ({ ...widget }));

const matches = (response: DashboardMockResponse, method: string, pathname: string) =>
  (response.method ?? "GET") === method &&
  (typeof response.path === "string" ? response.path === pathname : response.path.test(pathname));

const fulfill = async (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Creates a promise that holds a mocked response until the test releases it. */
export const createDashboardResponseGate = () => {
  let release: (value: void) => void = () => undefined;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  return { released, release: () => release() };
};

/**
 * Serves the dashboard layout and widget endpoints from test data (UI-contract suites, strategy §9).
 * Layout updates and resets are kept in memory, so a reload shows what the page saved.
 */
export const mockDashboardFlow = async (page: Page, options: MockDashboardOptions) => {
  let revision = 0;
  let widgets = copyWidgets(options.widgets);
  let resetRequests = 0;
  const updates: DashboardLayoutWidget[][] = [];
  const requestUrls: URL[] = [];
  const catalogTypes = options.catalog ?? options.widgets.map((widget) => widget.type);
  const catalog = catalogTypes.map((type) => ({
    type,
    allowedSizes: [...DASHBOARD_WIDGET_CATALOG[type].allowedSizes],
    defaultSize:
      options.widgets.find((widget) => widget.type === type)?.size ??
      DASHBOARD_WIDGET_CATALOG[type].defaultSize,
  }));
  const layoutBody = () => ({
    data: { layout: { schemaVersion: DASHBOARD_SCHEMA_VERSION, revision, widgets }, catalog },
  });
  const responses = [...(options.responses ?? []), ...EMPTY_WIDGET_RESPONSES];

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    requestUrls.push(url);

    if (url.pathname === "/api/settings" && method === "GET") {
      await fulfill(route, 200, {
        data: { language: "en", isMFAEnabled: false, MFASecret: null, dashboard: { widgets: [] } },
      });
      return;
    }

    if (url.pathname === "/api/settings/dashboard" && method === "GET") {
      await fulfill(route, 200, layoutBody());
      return;
    }

    if (url.pathname === "/api/settings/dashboard" && method === "PUT") {
      const payload: { widgets: DashboardLayoutWidget[] } = request.postDataJSON();
      widgets = copyWidgets(payload.widgets);
      updates.push(copyWidgets(widgets));
      revision += 1;
      await fulfill(route, 200, layoutBody());
      return;
    }

    if (url.pathname === "/api/settings/dashboard/reset" && method === "POST") {
      resetRequests += 1;
      widgets = copyWidgets(options.resetWidgets ?? options.widgets);
      updates.push(copyWidgets(widgets));
      revision += 1;
      await fulfill(route, 200, layoutBody());
      return;
    }

    const response = responses.find((candidate) => matches(candidate, method, url.pathname));
    if (!response) {
      await route.continue();
      return;
    }

    const body = response.respond ? await response.respond({ request, url }) : response.body;
    await fulfill(route, response.status ?? 200, body);
  });

  return {
    getWidgets: () => copyWidgets(widgets),
    getResetRequests: () => resetRequests,
    updates,
    /** Every API request the page sent while mocked, newest last. */
    requestsTo: (pathname: string | RegExp) =>
      requestUrls.filter((url) =>
        typeof pathname === "string" ? url.pathname === pathname : pathname.test(url.pathname),
      ),
  };
};
