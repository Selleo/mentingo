import { USER_ROLE } from "~/config/userRoles";
import { COURSE_LIST_LAYOUT_VARIANT } from "~/modules/Dashboard/Settings/components/admin/courseListLayout";

import { LOGIN_PAGE_HANDLES } from "../../data/auth/handles";
import {
  COURSE_DISCUSSION_HANDLES,
  COURSE_OVERVIEW_HANDLES,
  COURSES_PAGE_HANDLES,
} from "../../data/courses/handles";
import { SETTINGS_PAGE_HANDLES } from "../../data/settings/handles";
import { createFixtureFactories } from "../../factories";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openFeaturesSettingsFlow } from "../../flows/settings/open-features-settings.flow";
import { togglePlatformFeatureFlow } from "../../flows/settings/toggle-platform-feature.flow";
import { waitForApiResponse } from "../../utils/api-requests";
import { setCourseSettings } from "../../utils/course-settings";
import { getGlobalSettings } from "../../utils/global-settings";

test("admin opens courses to visitors, switches the course list layout and enables course discussions", async ({
  apiClient,
  cleanup,
  createWorkspacePage,
  withWorkerPage,
  workerTenantApiClient: adminApiClient,
}) => {
  let courseId = "";
  let studentId = "";

  await withWorkerPage(USER_ROLE.student, async () => {
    const { data: currentUser } = await apiClient.api.authControllerCurrentUser();
    studentId = currentUser.data.id;
  });

  // Settings, data and cleanup go through the tenant admin client, which outlives the role switches.
  const factories = createFixtureFactories(adminApiClient);

  await withWorkerPage(USER_ROLE.admin, async () => {
    const originalSettings = await getGlobalSettings(adminApiClient);
    cleanup.add(() => setCourseSettings(adminApiClient, originalSettings));
    await setCourseSettings(adminApiClient, {
      unregisteredUserCoursesAccessibility: false,
      modernCourseListEnabled: false,
      courseDiscussionsEnabled: false,
    });

    const categoryFactory = factories.createCategoryFactory();
    const courseFactory = factories.createCourseFactory();
    const category = await categoryFactory.create(`Course settings ${Date.now()}`);
    cleanup.add(() => categoryFactory.delete(category.id));
    const course = await courseFactory.create({
      title: `course-settings-${Date.now()}`,
      categoryId: category.id,
      status: "published",
    });
    cleanup.add(() => courseFactory.delete(course.id));
    await factories.createEnrollmentFactory().enrollUsers(course.id, [studentId]);
    courseId = course.id;
  });

  const visitor = await createWorkspacePage();
  cleanup.add(() => visitor.context.close());

  await visitor.page.goto("/courses");
  await expect(visitor.page.getByTestId(LOGIN_PAGE_HANDLES.PAGE)).toBeVisible();

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByTestId(COURSES_PAGE_HANDLES.LEGACY_VIEW)).toBeVisible();

    const globalSettingsLoaded = waitForApiResponse(page, "GET", "/api/settings/global");
    await openCourseOverviewFlow(page, courseId);
    await globalSettingsLoaded;
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO)).toBeVisible();
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB)).toHaveCount(0);
  });

  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    await openFeaturesSettingsFlow(page);
    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.COURSES_VISIBILITY_SWITCH);
    await togglePlatformFeatureFlow(page, SETTINGS_PAGE_HANDLES.COURSE_DISCUSSIONS_SWITCH);

    await page.getByTestId(SETTINGS_PAGE_HANDLES.PLATFORM_CUSTOMIZATION_TAB).click();
    await page
      .getByTestId(SETTINGS_PAGE_HANDLES.courseListLayoutOption(COURSE_LIST_LAYOUT_VARIANT.MODERN))
      .click();

    await expect
      .poll(async () => {
        const settings = await getGlobalSettings(adminApiClient);

        return {
          courseDiscussionsEnabled: settings.courseDiscussionsEnabled,
          modernCourseListEnabled: settings.modernCourseListEnabled,
          unregisteredUserCoursesAccessibility: settings.unregisteredUserCoursesAccessibility,
        };
      })
      .toEqual({
        courseDiscussionsEnabled: true,
        modernCourseListEnabled: true,
        unregisteredUserCoursesAccessibility: true,
      });
  });

  await visitor.page.goto("/courses");
  await expect(visitor.page.getByTestId(COURSES_PAGE_HANDLES.MODERN_VIEW)).toBeVisible();

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_DISCUSSION_HANDLES.TAB)).toBeVisible();
  });
});
