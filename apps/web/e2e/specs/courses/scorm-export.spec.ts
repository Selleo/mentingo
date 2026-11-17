import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
import { COURSE_TAB_VALUES, SCORM_EXPORT_CARD_HANDLES } from "../../data/courses/handles";
import { expect, test } from "../../fixtures/test.fixture";
import {
  openCourseOverviewSettingsFlow,
  selectCourseOverviewSettingsTabFlow,
} from "../../flows/courses/open-course-overview-settings.flow";
import { createCurriculumCourse } from "../curriculum/curriculum-test-helpers";

const SCORM_EXPORT_JOB_ID = "scorm-export-job";

const mockScormExportDownload = async (
  page: Parameters<typeof openCourseOverviewSettingsFlow>[0],
) => {
  let exportRequestUrl: string | null = null;
  let packageDownloaded = false;

  await page.route("**/api/course/*/scorm-export**", async (route) => {
    exportRequestUrl = route.request().url();
    await route.fulfill({ status: 201, json: { data: { jobId: SCORM_EXPORT_JOB_ID } } });
  });
  await page.route(`**/api/native-archives/jobs/${SCORM_EXPORT_JOB_ID}`, (route) =>
    route.fulfill({
      json: {
        data: {
          jobId: SCORM_EXPORT_JOB_ID,
          state: "completed",
          result: null,
          failedReason: null,
          progress: { stage: "packaging", percent: 100 },
        },
      },
    }),
  );
  await page.route(`**/api/native-archives/jobs/${SCORM_EXPORT_JOB_ID}/download-url`, (route) =>
    route.fulfill({
      json: {
        data: {
          url: new URL("/mock-scorm-export.zip", route.request().url()).href,
          expiresInSeconds: 300,
        },
      },
    }),
  );
  await page.route("**/mock-scorm-export.zip", async (route) => {
    packageDownloaded = true;
    await route.fulfill({
      headers: {
        "content-disposition": 'attachment; filename="course-scorm-12.zip"',
        "content-type": "application/zip",
      },
      body: Buffer.from("mock scorm zip"),
    });
  });

  return {
    getExportRequestUrl: () => exportRequestUrl,
    isPackageDownloaded: () => packageDownloaded,
  };
};

test("admin can export a course as a SCORM package from the exports tab", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `scorm-export-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `scorm-export-chapter-${Date.now()}`,
    });
    await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `scorm-export-content-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    const exportDownload = await mockScormExportDownload(page);

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.EXPORTS);
    await expect(page.getByTestId(SCORM_EXPORT_CARD_HANDLES.ROOT)).toBeVisible();
    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON).click();

    await expect
      .poll(() => exportDownload.getExportRequestUrl())
      .toContain(`/api/course/${course.id}/scorm-export`);
    expect(exportDownload.getExportRequestUrl()).toContain("language=en");
    await expect.poll(() => exportDownload.isPackageDownloaded()).toBe(true);
    await expect(page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toBeVisible();
  });
});

test("admin confirms SCORM export when unsupported lessons will be skipped", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `scorm-export-warning-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `scorm-export-warning-chapter-${Date.now()}`,
    });
    await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `scorm-export-supported-content-${Date.now()}`,
    });
    await curriculumFactory.createAiMentorLesson(course.id, {
      chapterId: chapter.id,
      title: `scorm-export-ai-mentor-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    const exportDownload = await mockScormExportDownload(page);

    await openCourseOverviewSettingsFlow(page, course.id);
    await selectCourseOverviewSettingsTabFlow(page, COURSE_TAB_VALUES.EXPORTS);
    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.EXPORT_BUTTON).click();
    await expect(page.getByTestId(SCORM_EXPORT_CARD_HANDLES.WARNING_DIALOG)).toBeVisible();
    expect(exportDownload.getExportRequestUrl()).toBeNull();

    await page.getByTestId(SCORM_EXPORT_CARD_HANDLES.WARNING_CONFIRM_BUTTON).click();

    await expect
      .poll(() => exportDownload.getExportRequestUrl())
      .toContain(`/api/course/${course.id}/scorm-export`);
  });
});
