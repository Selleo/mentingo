import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
import { COURSE_TAB_VALUES, SCORM_EXPORT_CARD_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { arrangeCurriculumChapter } from "../curriculum/curriculum-test-helpers";

// The export runs as a background job that packages the course before the browser downloads it.
const SCORM_EXPORT_DOWNLOAD_TIMEOUT = 60_000;

test("admin can export a course as a SCORM package from the exports tab", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `scorm-export-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    await factories.createCurriculumFactory().createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-content`,
    });

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.EXPORTS);
    await expect(page.getByTestId(SCORM_EXPORT_CARD_HANDLES.ROOT)).toBeVisible();

    const exportRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        request.url().includes(`/api/course/${course.id}/scorm-export`),
    );
    const download = page.waitForEvent("download", { timeout: SCORM_EXPORT_DOWNLOAD_TIMEOUT });
    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON).click();

    expect(new URL((await exportRequest).url()).searchParams.get("language")).toBe("en");
    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    await expect(page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toBeVisible();
  });
});

test("admin confirms SCORM export when unsupported lessons will be skipped", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const prefix = `scorm-export-warning-${Date.now()}`;
    const { course, chapter } = await arrangeCurriculumChapter({
      cleanup,
      factories,
      title: prefix,
    });
    const curriculumFactory = factories.createCurriculumFactory();
    await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-supported-content`,
    });
    await curriculumFactory.createAiMentorLesson(course.id, {
      chapterId: chapter.id,
      title: `${prefix}-ai-mentor`,
    });

    const exportRequestUrls: URL[] = [];
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes(`/api/course/${course.id}/scorm-export`)
      ) {
        exportRequestUrls.push(new URL(request.url()));
      }
    });

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.EXPORTS);
    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON).click();
    await expect(page.getByTestId(SCORM_EXPORT_CARD_HANDLES.WARNING_DIALOG)).toBeVisible();
    expect(exportRequestUrls).toHaveLength(0);

    const download = page.waitForEvent("download", { timeout: SCORM_EXPORT_DOWNLOAD_TIMEOUT });
    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.WARNING_CONFIRM_BUTTON).click();

    expect((await download).suggestedFilename()).toMatch(/\.zip$/);
    expect(exportRequestUrls).toHaveLength(1);
    expect(exportRequestUrls[0].searchParams.get("language")).toBe("en");
  });
});
