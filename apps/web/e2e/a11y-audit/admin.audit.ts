import { USER_ROLE } from "~/config/userRoles";

import { CATEGORIES_PAGE_HANDLES } from "../data/categories/handles";
import {
  COURSE_TAB_VALUES,
  COURSE_TYPE_SELECTOR_HANDLES,
  COURSES_PAGE_HANDLES,
  CREATE_COURSE_PAGE_HANDLES,
  EDIT_COURSE_PAGE_HANDLES,
} from "../data/courses/handles";
import { CURRICULUM_HANDLES } from "../data/curriculum/handles";
import { DASHBOARD_WIDGET_HANDLES } from "../data/dashboard/handles";
import { EMAIL_TEMPLATES_HANDLES } from "../data/email-templates/handles";
import { GAMIFICATION_ADMIN_HANDLES } from "../data/gamification-admin/handles";
import { CREATE_GROUP_PAGE_HANDLES, GROUPS_PAGE_HANDLES } from "../data/groups/handles";
import { LEARNING_PATHS_PAGE_HANDLES } from "../data/learning-paths/handles";
import { REPORTS_HANDLES } from "../data/reports/handles";
import { SETTINGS_PAGE_SELECTORS } from "../data/settings/handles";
import { CREATE_USER_PAGE_HANDLES, USERS_PAGE_HANDLES } from "../data/users/handles";
import { expect, test } from "../fixtures/test.fixture";
import { ensureLeaderboardFeatures } from "../utils/leaderboard-features";
import { createTwoContentLessonsCourse } from "../utils/learning-courses";
import { overrideLearningPathsEnabled } from "../utils/learning-paths";

import { openAndScanView, type AuditedView } from "./scan-view";
import { AUDIT_ROLE } from "./wcag-audit.types";

const ADMIN_MANAGEMENT_VIEWS: AuditedView[] = [
  {
    viewId: "admin-dashboard",
    viewName: "Admin dashboard",
    path: "/dashboard",
    ready: (page) => page.getByTestId(DASHBOARD_WIDGET_HANDLES.ADMIN_TRAINING_COMPLETION),
  },
  {
    viewId: "admin-users",
    viewName: "Users list",
    path: "/admin/users",
    ready: (page) => page.getByTestId(USERS_PAGE_HANDLES.TABLE),
  },
  {
    viewId: "admin-create-user",
    viewName: "Create user",
    path: "/admin/users/new",
    ready: (page) => page.getByTestId(CREATE_USER_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "admin-groups",
    viewName: "Groups list",
    path: "/admin/groups",
    ready: (page) => page.getByTestId(GROUPS_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "admin-create-group",
    viewName: "Create group",
    path: "/admin/groups/new",
    ready: (page) => page.getByTestId(CREATE_GROUP_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "admin-categories",
    viewName: "Categories list",
    path: "/admin/categories",
    ready: (page) => page.getByTestId(CATEGORIES_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "admin-learning-paths",
    viewName: "Learning paths management",
    path: "/development-paths",
    ready: (page) => page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.ADMIN_PAGE),
  },
  {
    viewId: "admin-gamification",
    viewName: "Gamification settings",
    path: "/admin/gamification",
    ready: (page) => page.getByTestId(GAMIFICATION_ADMIN_HANDLES.PAGE),
  },
  {
    viewId: "admin-email-templates",
    viewName: "Email templates",
    path: "/admin/email-templates",
    ready: (page) => page.getByTestId(EMAIL_TEMPLATES_HANDLES.TABLE),
  },
  {
    viewId: "admin-reports",
    viewName: "Reports",
    path: "/reports",
    ready: (page) => page.getByTestId(REPORTS_HANDLES.FILTERS_TOGGLE),
  },
  {
    viewId: "admin-settings",
    viewName: "Platform settings",
    path: "/settings",
    ready: (page) => page.locator(SETTINGS_PAGE_SELECTORS.PAGE),
  },
];

test("admin course authoring path: list, new course form with errors, editor and curriculum", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const { courseId } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix: `wcag-audit-admin-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    await openAndScanView(page, AUDIT_ROLE.ADMIN, {
      viewId: "admin-courses",
      viewName: "Courses list",
      path: "/admin/courses",
      ready: (currentPage) => currentPage.getByTestId(COURSES_PAGE_HANDLES.TABLE),
    });

    await openAndScanView(page, AUDIT_ROLE.ADMIN, {
      viewId: "admin-course-type-selector",
      viewName: "New course: type selector",
      path: "/admin/beta-courses/new",
      ready: (currentPage) => currentPage.getByTestId(COURSE_TYPE_SELECTOR_HANDLES.PAGE),
    });

    await openAndScanView(page, AUDIT_ROLE.ADMIN, {
      viewId: "admin-create-course",
      viewName: "New course form",
      path: "/admin/beta-courses/new/standard",
      ready: (currentPage) => currentPage.getByTestId(CREATE_COURSE_PAGE_HANDLES.PAGE),
    });

    // No error state to scan: the admin forms keep submit disabled until valid and show no errors.
    await expect(page.getByTestId(CREATE_COURSE_PAGE_HANDLES.SUBMIT_BUTTON)).toBeDisabled();

    await openAndScanView(page, AUDIT_ROLE.ADMIN, {
      viewId: "admin-edit-course-settings",
      viewName: "Course editor: settings",
      path: `/admin/beta-courses/${courseId}?tab=${COURSE_TAB_VALUES.SETTINGS}`,
      ready: (currentPage) => currentPage.getByTestId(EDIT_COURSE_PAGE_HANDLES.PAGE),
    });

    await openAndScanView(page, AUDIT_ROLE.ADMIN, {
      viewId: "admin-edit-course-curriculum",
      viewName: "Course editor: curriculum",
      path: `/admin/beta-courses/${courseId}?tab=${COURSE_TAB_VALUES.CURRICULUM}`,
      ready: (currentPage) => currentPage.getByTestId(CURRICULUM_HANDLES.ROOT),
    });
  });
});

test("admin management pages", async ({ cleanup, withWorkerPage, workerTenantApiClient }) => {
  cleanup.add(await overrideLearningPathsEnabled(workerTenantApiClient));
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, { gamificationEnabled: true }),
  );

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const view of ADMIN_MANAGEMENT_VIEWS) {
      await openAndScanView(page, AUDIT_ROLE.ADMIN, view);
    }
  });
});
