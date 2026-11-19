import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { PROFILE_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertNoAxeViolationsFlow } from "../../flows/accessibility/assert-no-axe-violations.flow";
import { clickHandleAndExpectUrlFlow } from "../../flows/click-handle-and-expect-url.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { createTwoContentLessonsCourse } from "../../utils/learning-courses";

// Every disabled rule links the #2209 sub-ticket that fixes it. A new finding with no ticket gets a
// row in https://github.com/Selleo/mentingo/issues/2292 and is disabled here with that link.
const RULES_DISABLED_ON_ALL_PAGES = [
  // Search button shows "Search" but is named "Find in application": https://github.com/Selleo/mentingo/issues/2292
  "label-content-name-mismatch",
];
const RULES_DISABLED_UNTIL_CONTRAST_FIX = [
  ...RULES_DISABLED_ON_ALL_PAGES,
  // Re-enable once https://github.com/Selleo/mentingo/issues/2213 (PR #2284) is merged.
  "color-contrast",
];

test("learner pages have no WCAG 2.2 A/AA axe violations", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const prefix = `axe-${Date.now()}`;
  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await enrollmentFactory.selfEnroll(courseId);
    const currentUser = await apiClient.api.authControllerCurrentUser();

    await openDashboardFlow(page);
    await assertNoAxeViolationsFlow(page, {
      // Donut chart text alternative: https://github.com/Selleo/mentingo/issues/2287
      disabledRules: [...RULES_DISABLED_UNTIL_CONTRAST_FIX, "svg-img-alt"],
    });

    await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");
    // The enrolled course can show in several sections of the list.
    await expect(
      page.getByTestId(COURSES_PAGE_HANDLES.courseCard(`${prefix}-course`)).first(),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_UNTIL_CONTRAST_FIX });

    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_UNTIL_CONTRAST_FIX });

    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.firstLesson.title,
    );
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(lessons.secondLesson.id)),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_UNTIL_CONTRAST_FIX });

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await clickHandleAndExpectUrlFlow(
      page,
      NAVIGATION_HANDLES.PROFILE_LINK,
      new RegExp(`/profile/${currentUser.data.data.id}$`),
    );
    // The closing profile menu keeps the rest of the page aria-hidden until it unmounts.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId(PROFILE_PAGE_HANDLES.USERNAME)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });
  });
});
