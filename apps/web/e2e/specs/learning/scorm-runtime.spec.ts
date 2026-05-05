import { USER_ROLE } from "~/config/userRoles";

import { TOAST_HANDLES } from "../../data/common/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { SCORM_PACKAGE_HANDLES } from "../../data/scorm/handles";
import { SCORM_TEST_DATA } from "../../data/scorm/scorm.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillCreateScormCourseFormFlow } from "../../flows/courses/fill-create-scorm-course-form.flow";
import { openCreateScormCoursePageFlow } from "../../flows/courses/open-create-scorm-course-page.flow";
import { submitCreateScormCourseFormFlow } from "../../flows/courses/submit-create-scorm-course-form.flow";
import { fillScormLessonFormFlow } from "../../flows/curriculum/fill-scorm-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveScormLessonFormFlow } from "../../flows/curriculum/save-scorm-lesson-form.flow";
import { assertCourseLessonProgressFlow } from "../../flows/learning/assert-learning-progress.flow";
import { clickScormIframeButtonFlow } from "../../flows/learning/click-scorm-iframe-button.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";

import type { FixtureFactories } from "../../factories";
import type { PageHandle } from "../../fixtures/types";
import type { Page } from "@playwright/test";
import type { UserRole } from "~/config/userRoles";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type WithWorkerPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: { root?: boolean },
) => Promise<void>;

const scormFrame = (page: Page) => page.getByTestId(LEARNING_HANDLES.SCORM_IFRAME).contentFrame();

async function createScormCourseForLearning({
  cleanup,
  factories,
  packagePath,
  prefix,
  withWorkerPage,
}: {
  cleanup: Cleanup;
  factories: FixtureFactories;
  packagePath: string;
  prefix: string;
  withWorkerPage: WithWorkerPage;
}) {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const title = `${prefix}-course`;

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const category = await categoryFactory.create(`${prefix}-category`);

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            const createdCourse = await courseFactory.findByTitle(title);
            if (createdCourse) {
              await courseFactory.update(createdCourse.id, { status: "draft", language: "en" });
              await courseFactory.delete(createdCourse.id);
            }
            await categoryFactory.delete(category.id);
          },
          { root: true },
        );
      });

      await openCreateScormCoursePageFlow(page);
      await fillCreateScormCourseFormFlow(page, {
        title,
        categoryTitle: category.title,
        language: "en",
        description: `Description for ${title}`,
        packagePath,
      });
      await submitCreateScormCourseFormFlow(page);

      const course = await expect
        .poll(async () => courseFactory.findByTitle(title), { timeout: 30_000 })
        .not.toBeNull()
        .then(async () => (await courseFactory.findByTitle(title))!);

      await courseFactory.update(course.id, { status: "published", language: "en" });
    },
    { root: true },
  );

  const course = await courseFactory.findByTitle(title);
  if (!course) throw new Error(`SCORM learning course ${title} was not created`);

  return courseFactory.getById(course.id);
}

async function createMultiScoLessonCourseForLearning({
  cleanup,
  factories,
  prefix,
  withWorkerPage,
}: {
  cleanup: Cleanup;
  factories: FixtureFactories;
  prefix: string;
  withWorkerPage: WithWorkerPage;
}) {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();

  const title = `${prefix}-course`;

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const category = await categoryFactory.create(`${prefix}-category`);
      const course = await courseFactory.create({
        title,
        categoryId: category.id,
        language: "en",
        status: "draft",
      });
      const chapter = await curriculumFactory.createChapter({
        courseId: course.id,
        title: `${prefix}-chapter`,
      });

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await courseFactory.update(course.id, { status: "draft", language: "en" });
            await courseFactory.delete(course.id);
            await categoryFactory.delete(category.id);
          },
          { root: true },
        );
      });

      await openCurriculumPageFlow(page, course.id);
      await openNewLessonFormFlow(page, chapter.id, "scorm");
      await fillScormLessonFormFlow(page, {
        title: `${prefix}-multi-sco-lesson`,
        packagePath: SCORM_TEST_DATA.files.multiScoPackage,
      });
      await saveScormLessonFormFlow(page);

      await expect
        .poll(
          async () => {
            const updatedCourse = await courseFactory.getById(course.id);
            return updatedCourse.chapters[0]?.lessons?.some((lesson) => lesson.type === "scorm");
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      await courseFactory.update(course.id, { status: "published", language: "en" });
    },
    { root: true },
  );

  const course = await courseFactory.findByTitle(title);
  if (!course) throw new Error(`SCORM multi-SCO lesson course ${title} was not created`);

  return courseFactory.getById(course.id);
}

test("student can launch, resume, fullscreen, and finish a SCORM lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const course = await createScormCourseForLearning({
    cleanup,
    factories,
    packagePath: SCORM_TEST_DATA.files.singleScoPackage,
    prefix: `learning-scorm-single-${Date.now()}`,
    withWorkerPage,
  });
  const lesson = course.chapters[0]!.lessons![0]!;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(course.id);
      await openCourseOverviewFlow(page, course.id);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lesson.id}$`));
      await expect(scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.SINGLE_TITLE)).toBeVisible();
      await expect(scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.ENTRY)).toHaveText(
        "ab-initio",
      );

      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/commit")),
        clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.COMMIT_PROGRESS_BUTTON),
      ]);

      await page.reload();
      await expect(scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.ENTRY)).toHaveText("resume");

      await clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.PACKAGE_CONFIRM_BUTTON);
      await expect(page.getByTestId(LEARNING_HANDLES.SCORM_PACKAGE_DIALOG)).toBeVisible();
      await page.getByTestId(LEARNING_HANDLES.SCORM_PACKAGE_DIALOG_OK_BUTTON).click();

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

      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
        clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_LESSON_BUTTON),
      ]);
      await expect(page.getByTestId(TOAST_HANDLES.DESCRIPTION)).toHaveText(
        "SCORM lesson finished.",
      );

      await assertCourseLessonProgressFlow(apiClient, course.id, {
        completedLessonCount: 1,
        lessonId: lesson.id,
        lessonStatus: "completed",
      });
    },
    { root: true },
  );
});

test("student can navigate and complete a multi-SCO SCORM lesson", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const course = await createMultiScoLessonCourseForLearning({
    cleanup,
    factories,
    prefix: `learning-scorm-multi-${Date.now()}`,
    withWorkerPage,
  });
  const lesson = course.chapters[0]!.lessons![0]!;

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(course.id);
      await openCourseOverviewFlow(page, course.id);
      await startLearningFlow(page);

      await expect(page).toHaveURL(new RegExp(`/course/.+/lesson/${lesson.id}$`));
      await expect(page.getByTestId(LEARNING_HANDLES.SCORM_NAVIGATION)).toBeVisible();
      await expect(page.getByTestId(LEARNING_HANDLES.SCORM_PREVIOUS_SECTION_BUTTON)).toBeDisabled();
      await expect(page.getByTestId(LEARNING_HANDLES.SCORM_NEXT_SECTION_BUTTON)).toBeEnabled();
      await expect(
        scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.SECTION_ONE_TITLE),
      ).toBeVisible();

      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
        clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_SECTION_ONE_BUTTON),
      ]);

      await page.getByTestId(LEARNING_HANDLES.SCORM_NEXT_SECTION_BUTTON).click();
      await expect(
        scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.SECTION_TWO_TITLE),
      ).toBeVisible();
      await expect(
        scormFrame(page).getByTestId(SCORM_PACKAGE_HANDLES.MANIFEST_PARAMETER),
      ).toHaveText("?fromManifest=true");

      await Promise.all([
        page.waitForResponse((response) => response.url().includes("/api/scorm/runtime/finish")),
        clickScormIframeButtonFlow(page, SCORM_PACKAGE_HANDLES.FINISH_SECTION_TWO_BUTTON),
      ]);

      await assertCourseLessonProgressFlow(apiClient, course.id, {
        completedLessonCount: 1,
        lessonId: lesson.id,
        lessonStatus: "completed",
      });
    },
    { root: true },
  );
});
