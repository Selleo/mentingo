import { SCORM_PLAYER_ATTRIBUTES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { SCORM_PACKAGE_HANDLES } from "../../data/scorm/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertCourseLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { clickScormIframeButtonFlow } from "../../flows/learning/click-scorm-iframe-button.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import {
  createMultiScoScormLessonCourse,
  createScormPackageCourse,
} from "../../utils/learning-courses";

test.use({
  launchOptions: { args: ["--ignore-certificate-errors", "--allow-insecure-localhost"] },
});

test("student can launch, resume, fullscreen, and finish a SCORM lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId, lessonId } = await createScormPackageCourse({
    cleanup,
    factories,
    prefix: `learning-scorm-single-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const scormFrame = page
      .getByTestId(LEARNING_HANDLES.SCORM_IFRAME)
      .contentFrame()
      .getByTestId(LEARNING_HANDLES.SCORM_PACKAGE_IFRAME)
      .contentFrame();

    await enrollmentFactory.selfEnroll(courseId);
    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessonId}$`));
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.SINGLE_TITLE)).toBeVisible();
    const wrapper = page.getByTestId(LEARNING_HANDLES.SCORM_IFRAME);
    await expect(wrapper).toHaveAttribute("sandbox", SCORM_PLAYER_ATTRIBUTES.SANDBOX);
    const contentUrl = (await wrapper.getAttribute("src")) ?? "";
    expect(new URL(contentUrl).origin).not.toBe(new URL(page.url()).origin);
    const isolation = await scormFrame
      .getByTestId(SCORM_PACKAGE_HANDLES.SINGLE_TITLE)
      .evaluate(() => {
        let canReadApplication = false;
        try {
          canReadApplication = Boolean(window.top?.document.body);
        } catch {
          /* Browser denied access. */
        }
        return {
          canReadApplication,
          cookies: document.cookie,
          popupBlocked: window.open("about:blank") === null,
        };
      });
    expect(isolation.canReadApplication).toBe(false);
    expect(isolation.cookies).not.toContain("access_token=");
    expect(isolation.cookies).not.toContain("refresh_token=");
    expect(isolation.popupBlocked).toBe(true);
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.ENTRY)).toHaveText("ab-initio");

    const [commitResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/commit")),
      clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.COMMIT_PROGRESS_BUTTON),
    ]);
    expect(commitResponse.ok()).toBe(true);

    await page.reload();
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.ENTRY)).toHaveText("resume");

    await page.getByTestId(LEARNING_HANDLES.SCORM_FULLSCREEN_BUTTON).click();
    await expect(page.getByTestId(LEARNING_HANDLES.SCORM_ROOT)).toHaveAttribute(
      "data-fullscreen",
      "true",
    );
    await page.getByTestId(LEARNING_HANDLES.SCORM_FULLSCREEN_BUTTON).click();
    await expect(page.getByTestId(LEARNING_HANDLES.SCORM_ROOT)).toHaveAttribute(
      "data-fullscreen",
      "false",
    );

    const [finishResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
      clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_LESSON_BUTTON),
    ]);
    expect(finishResponse.ok()).toBe(true);
    await expect(page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toBeVisible();

    await assertCourseLessonProgressFlow(apiClient, courseId, {
      completedLessonCount: 1,
      lessonId,
      lessonStatus: "completed",
    });
  });
});

test("student can navigate and complete a multi-SCO SCORM lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId, lessons } = await createMultiScoScormLessonCourse({
    cleanup,
    factories,
    prefix: `learning-scorm-multi-${Date.now()}`,
    withWorkerPage,
  });
  const { lessonId } = lessons;

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    const scormFrame = page
      .getByTestId(LEARNING_HANDLES.SCORM_IFRAME)
      .contentFrame()
      .getByTestId(LEARNING_HANDLES.SCORM_PACKAGE_IFRAME)
      .contentFrame();

    await enrollmentFactory.selfEnroll(courseId);
    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);

    await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lessonId}$`));
    await expect(page.getByTestId(LEARNING_HANDLES.SCORM_NAVIGATION)).toBeVisible();
    await expect(page.getByTestId(LEARNING_HANDLES.SCORM_PREVIOUS_SECTION_BUTTON)).toBeDisabled();
    await expect(page.getByTestId(LEARNING_HANDLES.SCORM_NEXT_SECTION_BUTTON)).toBeEnabled();
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.SECTION_ONE_TITLE)).toBeVisible();

    const [sectionOneFinishResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
      clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_SECTION_ONE_BUTTON),
    ]);
    expect(sectionOneFinishResponse.ok()).toBe(true);

    await page.getByTestId(LEARNING_HANDLES.SCORM_NEXT_SECTION_BUTTON).click();
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.SECTION_TWO_TITLE)).toBeVisible();
    await expect(scormFrame.getByTestId(SCORM_PACKAGE_HANDLES.MANIFEST_PARAMETER)).toHaveText(
      "?fromManifest=true",
    );

    const [sectionTwoFinishResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
      clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_SECTION_TWO_BUTTON),
    ]);
    expect(sectionTwoFinishResponse.ok()).toBe(true);

    await assertCourseLessonProgressFlow(apiClient, courseId, {
      completedLessonCount: 1,
      lessonId,
      lessonStatus: "completed",
    });
  });
});
