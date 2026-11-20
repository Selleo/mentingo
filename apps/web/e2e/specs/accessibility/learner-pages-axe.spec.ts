import { USER_ROLE } from "~/config/userRoles";

import { COURSE_OVERVIEW_HANDLES, COURSES_PAGE_HANDLES } from "../../data/courses/handles";
import { DASHBOARD_WIDGET_HANDLES } from "../../data/dashboard/handles";
import { LEARNING_HANDLES } from "../../data/learning/handles";
import { LIVE_TRAINING_LESSON_HANDLES } from "../../data/live-training/handles";
import { NAVIGATION_HANDLES } from "../../data/navigation/handles";
import { SCORM_PACKAGE_HANDLES } from "../../data/scorm/handles";
import { PROFILE_PAGE_HANDLES } from "../../data/users/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { assertNoAxeViolationsFlow } from "../../flows/accessibility/assert-no-axe-violations.flow";
import { clickHandleAndExpectUrlFlow } from "../../flows/click-handle-and-expect-url.flow";
import { openDashboardFlow } from "../../flows/dashboard/open-dashboard.flow";
import { answerAllRenderedQuizQuestionTypesFlow } from "../../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { dismissAiMentorTaskDescriptionFlow } from "../../flows/learning/dismiss-ai-mentor-task-description.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../../flows/learning/open-lesson-from-sidebar.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import {
  createAiMentorLessonCourse,
  createAllRenderedQuestionTypesQuizCourse,
  createPublishedLearningCourse,
  createScormPackageCourse,
  createTwoContentLessonsCourse,
} from "../../utils/learning-courses";

// Disabled rules: check the open #2209 sub-tickets first; if none fits, add a row to
// https://github.com/Selleo/mentingo/issues/2292. Put the rule in RULES_DISABLED_ON_ALL_PAGES
// when it fails on every page, otherwise inline at the failing scan, each with its ticket link.
// Disabling a rule turns it off for the whole page, not only for the known element; that is
// deliberate. Remove the disable and its comment when the ticket closes.
// Excluded elements: only for a failure the owner decided to keep, at the scan that hits it, with
// its ticket link. `exclude` hides those elements from every rule, so keep the selector narrow.
const RULES_DISABLED_ON_ALL_PAGES = [
  // At 2xl (>=1536px) the search button shows "Search" but is named "Find in application":
  // https://github.com/Selleo/mentingo/issues/2292
  "label-content-name-mismatch",
];

test("learner pages have no WCAG 2.2 A/AA axe violations", async ({
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
    // Scan settled colors, not mid-transition ones.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();

    await openDashboardFlow(page);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page
        .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION)
        .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, {
      // Donut chart text alternative: https://github.com/Selleo/mentingo/issues/2287
      disabledRules: [...RULES_DISABLED_ON_ALL_PAGES, "svg-img-alt"],
      // Calendar days outside the month stay grey: https://github.com/Selleo/mentingo/issues/2311
      exclude: [`[data-testid="${DASHBOARD_WIDGET_HANDLES.EVENT_CALENDAR}"] .day-outside`],
    });

    await clickHandleAndExpectUrlFlow(page, NAVIGATION_HANDLES.COURSES_LINK, "/courses");
    // The enrolled course can show in several sections of the list.
    await expect(
      page.getByTestId(COURSES_PAGE_HANDLES.courseCard(`${prefix}-course`)).first(),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });

    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });

    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.firstLesson.title,
    );
    await expect(
      page.getByTestId(LEARNING_HANDLES.lessonSidebarLessonItem(lessons.secondLesson.id)),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await clickHandleAndExpectUrlFlow(
      page,
      NAVIGATION_HANDLES.PROFILE_LINK,
      new RegExp(`/profile/${studentId}$`),
    );
    // The closing profile menu keeps the rest of the page aria-hidden until it unmounts.
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(page.getByTestId(PROFILE_PAGE_HANDLES.USERNAME)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });
  });
});

test("embed and live training lessons have no WCAG 2.2 A/AA axe violations", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const prefix = `axe-lessons-${Date.now()}`;
  let liveTrainingId = "";

  await withWorkerPage(USER_ROLE.admin, async () => {
    // Registered before the course's cleanup, so it runs after the course (and its lesson link) is gone.
    const liveTraining = await factories
      .createLiveTrainingFactory()
      .createOffline(cleanup, { title: `${prefix}-training` });
    liveTrainingId = liveTraining.id;
  });

  // Content is scanned in the learner pages test; AI mentor and SCORM need their own environment.
  const { courseId, lessons } = await createPublishedLearningCourse({
    cleanup,
    factories,
    prefix,
    settings: { lessonSequenceEnabled: false },
    withWorkerPage,
    buildLessons: async ({ chapterId, courseId: createdCourseId, curriculumFactory }) => ({
      embedLesson: await curriculumFactory.createEmbedLesson(createdCourseId, {
        chapterId,
        title: `${prefix}-embed-lesson`,
        type: "embed",
        resources: [{ fileUrl: "https://example.com", allowFullscreen: true }],
      }),
      liveTrainingLesson: await curriculumFactory.createLiveTrainingLesson(createdCourseId, {
        chapterId,
        title: `${prefix}-live-training-lesson`,
        displayOrder: 2,
        liveTrainingId,
      }),
    }),
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.embedLesson.title,
    );
    await expect(page.getByTestId(LEARNING_HANDLES.EMBED_IFRAME)).toBeVisible();
    await assertNoAxeViolationsFlow(page, {
      // Embed fullscreen button has no name: https://github.com/Selleo/mentingo/issues/2287
      disabledRules: [...RULES_DISABLED_ON_ALL_PAGES, "button-name"],
    });

    await openLessonFromSidebarFlow(page, lessons.liveTrainingLesson.id);
    await expect(page.getByTestId(LIVE_TRAINING_LESSON_HANDLES.ROOT)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });
  });
});

test("a quiz with every question type has no WCAG 2.2 A/AA axe violations before and after submitting", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const QUIZ_DISABLED_RULES = [
    ...RULES_DISABLED_ON_ALL_PAGES,
    // Fill-in-the-blanks text input and 1-5 scale slider have no label:
    // https://github.com/Selleo/mentingo/issues/2287
    "label",
  ];
  let quizWasSubmitted = false;
  const { courseId, lessons } = await createAllRenderedQuestionTypesQuizCourse({
    cleanup,
    factories,
    includeScaleQuestion: true,
    prefix: `axe-quiz-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.quizLesson.title,
    );
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: QUIZ_DISABLED_RULES });

    await answerAllRenderedQuizQuestionTypesFlow(page, lessons.answers);
    await submitQuizFlow(page);
    quizWasSubmitted = true;
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await assertNoAxeViolationsFlow(page, { disabledRules: QUIZ_DISABLED_RULES });
  });
});

test("an AI mentor lesson has no WCAG 2.2 A/AA axe violations", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    const aiConfig = await apiClient.api.envControllerGetAiConfigured();

    // Opening the lesson generates the mentor's greeting, so it needs a live model.
    test.skip(!aiConfig.data.data.enabled, "OpenAI is not configured for this environment");
  });

  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId, lessons } = await createAiMentorLessonCourse({
    cleanup,
    factories,
    prefix: `axe-ai-mentor-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.aiMentorLesson.title,
    );
    await expect(
      page.getByTestId(LEARNING_HANDLES.AI_MENTOR_TASK_DESCRIPTION_DIALOG),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });

    await dismissAiMentorTaskDescriptionFlow(page);
    await expect(
      page.getByTestId(LEARNING_HANDLES.aiMentorMessageRole("assistant")).first(),
    ).toBeVisible({ timeout: 60_000 });
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });
  });
});

test("a SCORM lesson has no WCAG 2.2 A/AA axe violations", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  // shortcut: local worktrees have no SCORM content origin, so the package never loads there; CI sets
  // SCORM_CONTENT_ORIGIN. Drop the skip once local setups serve SCORM content.
  test.skip(!process.env.CI, "SCORM content needs the SCORM content origin configured in CI");

  const enrollmentFactory = factories.createEnrollmentFactory();
  const { courseId } = await createScormPackageCourse({
    cleanup,
    factories,
    prefix: `axe-scorm-${Date.now()}`,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);
    await expect(
      page
        .getByTestId(LEARNING_HANDLES.SCORM_IFRAME)
        .contentFrame()
        .getByTestId(LEARNING_HANDLES.SCORM_PACKAGE_IFRAME)
        .contentFrame()
        .getByTestId(SCORM_PACKAGE_HANDLES.SINGLE_TITLE),
    ).toBeVisible();
    await assertNoAxeViolationsFlow(page, { disabledRules: RULES_DISABLED_ON_ALL_PAGES });
  });
});
