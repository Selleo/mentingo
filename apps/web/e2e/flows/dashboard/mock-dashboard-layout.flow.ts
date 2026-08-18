import type { Page, Route } from "@playwright/test";
import type { DashboardWidgetSize } from "@repo/shared";

export type DashboardLayoutSize = DashboardWidgetSize;

export type DashboardLayoutWidget = {
  type: string;
  size: DashboardLayoutSize;
  visible: boolean;
};

export type DashboardLayoutCatalogEntry = {
  type: string;
  allowedSizes: DashboardLayoutSize[];
  defaultSize: DashboardLayoutSize;
};

type MockDashboardLayoutOptions = {
  widgets: DashboardLayoutWidget[];
  resetWidgets: DashboardLayoutWidget[];
  catalog: DashboardLayoutCatalogEntry[];
};

const fulfill = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: body }),
  });
};

const fulfillRaw = async (route: Route, body: unknown) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
};

const emptyWidgetResponse = async (route: Route, pathname: string) => {
  if (pathname === "/api/ai/practice/today") {
    await fulfill(route, null);
    return true;
  }
  if (pathname === "/api/calendar/dashboard/events") {
    await fulfill(route, []);
    return true;
  }
  if (pathname === "/api/course/dashboard-summary") {
    await fulfill(route, {
      continueLearningCourses: [],
      requiredCourses: [],
      completion: { total: 0, completed: 0, inProgress: 0, notStarted: 0, percentage: 0 },
    });
    return true;
  }
  if (pathname === "/api/statistics/dashboard/training-completion") {
    await fulfill(route, {
      completed: 0,
      inProgress: 0,
      notStarted: 0,
      total: 0,
      percentage: 0,
    });
    return true;
  }
  if (pathname === "/api/statistics/dashboard/deadline-risks/courses") {
    await fulfillRaw(route, {
      data: [],
      pagination: { totalItems: 0, page: 1, perPage: 20 },
    });
    return true;
  }
  if (pathname === "/api/certificates/dashboard" || pathname === "/api/todo-tasks") {
    await fulfillRaw(route, {
      data: [],
      pagination: { totalItems: 0, page: 1, perPage: 10 },
    });
    return true;
  }
  return false;
};

export async function mockDashboardLayout(page: Page, options: MockDashboardLayoutOptions) {
  let revision = 0;
  let widgets = options.widgets.map((widget) => ({ ...widget }));
  const resetWidgets = options.resetWidgets.map((widget) => ({ ...widget }));
  const updates: DashboardLayoutWidget[][] = [];
  let resetRequests = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname } = url;

    if (request.method() === "GET" && pathname === "/api/settings") {
      await fulfill(route, {
        language: "en",
        isMFAEnabled: false,
        MFASecret: null,
        dashboard: { widgets: [] },
      });
      return;
    }

    if (request.method() === "GET" && pathname === "/api/settings/dashboard") {
      await fulfill(route, {
        layout: { schemaVersion: 2, revision, widgets },
        catalog: options.catalog,
      });
      return;
    }

    if (request.method() === "PUT" && pathname === "/api/settings/dashboard") {
      const payload = request.postDataJSON() as { widgets: DashboardLayoutWidget[] };
      widgets = payload.widgets.map((widget) => ({ ...widget }));
      updates.push(widgets.map((widget) => ({ ...widget })));
      revision += 1;
      await fulfill(route, {
        layout: { schemaVersion: 2, revision, widgets },
        catalog: options.catalog,
      });
      return;
    }

    if (request.method() === "POST" && pathname === "/api/settings/dashboard/reset") {
      resetRequests += 1;
      widgets = resetWidgets.map((widget) => ({ ...widget }));
      updates.push(widgets.map((widget) => ({ ...widget })));
      revision += 1;
      await fulfill(route, {
        layout: { schemaVersion: 2, revision, widgets },
        catalog: options.catalog,
      });
      return;
    }

    if (request.method() === "GET" && (await emptyWidgetResponse(route, pathname))) return;

    await route.continue();
  });

  return {
    getWidgets: () => widgets.map((widget) => ({ ...widget })),
    getResetRequests: () => resetRequests,
    updates,
  };
}
