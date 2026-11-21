import { USER_ROLE } from "~/config/userRoles";

import { ARTICLES_PAGE_HANDLES } from "../data/articles/handles";
import { COURSE_OVERVIEW_HANDLES, COURSES_PAGE_HANDLES } from "../data/courses/handles";
import { DASHBOARD_WIDGET_HANDLES } from "../data/dashboard/handles";
import { FORUM_HANDLES } from "../data/forum/handles";
import { LEADERBOARD_HANDLES } from "../data/gamification/handles";
import { LEARNING_HANDLES } from "../data/learning/handles";
import { LEARNING_PATHS_PAGE_HANDLES } from "../data/learning-paths/handles";
import { CALENDAR_HANDLES } from "../data/live-training/handles";
import { NAVIGATION_HANDLES } from "../data/navigation/handles";
import { NEWS_PAGE_HANDLES } from "../data/news/handles";
import { QA_PAGE_HANDLES } from "../data/qa/handles";
import { SETTINGS_PAGE_SELECTORS } from "../data/settings/handles";
import { PROFILE_PAGE_HANDLES } from "../data/users/handles";
import { expect, test } from "../fixtures/test.fixture";
import { answerAllRenderedQuizQuestionTypesFlow } from "../flows/learning/answer-all-rendered-quiz-question-types.flow";
import { openCourseOverviewFlow } from "../flows/learning/open-course-overview.flow";
import { openLessonFromSidebarFlow } from "../flows/learning/open-lesson-from-sidebar.flow";
import { startLearningFlow } from "../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../flows/learning/submit-quiz.flow";
import { overrideContentModuleState } from "../utils/content-features";
import { setForumFeatureState } from "../utils/forum-features";
import { ensureLeaderboardFeatures } from "../utils/leaderboard-features";
import {
  createAllRenderedQuestionTypesQuizCourse,
  createTwoContentLessonsCourse,
} from "../utils/learning-courses";
import { overrideLearningPathsEnabled } from "../utils/learning-paths";

import { openAndScanView, scanView, type AuditedView } from "./scan-view";
import { AUDIT_ROLE } from "./wcag-audit.types";

test("student learning path: dashboard, catalogue, course, lessons, profile and settings", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const prefix = `wcag-audit-${Date.now()}`;
  const { courseId, lessons } = await createTwoContentLessonsCourse({
    cleanup,
    factories,
    prefix,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);
    const studentId = await enrollmentFactory.getCurrentUserId();

    await openAndScanView(page, AUDIT_ROLE.STUDENT, {
      viewId: "student-dashboard",
      viewName: "Student dashboard",
      path: "/dashboard",
      ready: (currentPage) =>
        currentPage
          .getByTestId(DASHBOARD_WIDGET_HANDLES.STUDENT_COURSE_COMPLETION)
          .getByTestId(DASHBOARD_WIDGET_HANDLES.CHART),
    });

    await openAndScanView(page, AUDIT_ROLE.STUDENT, {
      viewId: "student-courses",
      viewName: "Course catalogue",
      path: "/courses",
      ready: (currentPage) =>
        currentPage.getByTestId(COURSES_PAGE_HANDLES.courseCard(`${prefix}-course`)),
    });

    await openCourseOverviewFlow(page, courseId);
    await expect(page.getByTestId(COURSE_OVERVIEW_HANDLES.HERO_TITLE)).toBeVisible();
    await scanView(page, {
      viewId: "student-course-overview",
      viewName: "Course overview",
      role: AUDIT_ROLE.STUDENT,
    });

    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.firstLesson.title,
    );
    await scanView(page, {
      viewId: "student-content-lesson",
      viewName: "Content lesson",
      role: AUDIT_ROLE.STUDENT,
    });

    await openLessonFromSidebarFlow(page, lessons.secondLesson.id);
    await expect(page.getByTestId(LEARNING_HANDLES.LESSON_TITLE)).toHaveText(
      lessons.secondLesson.title,
    );
    await scanView(page, {
      viewId: "student-content-lesson-next",
      viewName: "Content lesson after sidebar navigation",
      role: AUDIT_ROLE.STUDENT,
      layoutAndKeyboardChecks: false,
    });

    await page.getByTestId(NAVIGATION_HANDLES.PROFILE_FOOTER).click();
    await expect(page.getByTestId(NAVIGATION_HANDLES.PROFILE_LINK)).toBeVisible();
    await scanView(page, {
      viewId: "student-profile-menu-open",
      viewName: "Open profile menu",
      role: AUDIT_ROLE.STUDENT,
      layoutAndKeyboardChecks: false,
    });
    await page.keyboard.press("Escape");

    await openAndScanView(page, AUDIT_ROLE.STUDENT, {
      viewId: "student-profile",
      viewName: "Profile",
      path: `/profile/${studentId}`,
      ready: (currentPage) => currentPage.getByTestId(PROFILE_PAGE_HANDLES.USERNAME),
    });

    await openAndScanView(page, AUDIT_ROLE.STUDENT, {
      viewId: "student-settings",
      viewName: "Account settings",
      path: "/settings",
      ready: (currentPage) => currentPage.locator(SETTINGS_PAGE_SELECTORS.PAGE),
    });
  });
});

test("student quiz path: every question type before and after submitting", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  let quizWasSubmitted = false;
  const { courseId, lessons } = await createAllRenderedQuestionTypesQuizCourse({
    cleanup,
    factories,
    includeScaleQuestion: true,
    prefix: `wcag-audit-quiz-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enrollmentFactory.selfEnroll(courseId);

    await openCourseOverviewFlow(page, courseId);
    await startLearningFlow(page);
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_FORM)).toBeVisible();
    await scanView(page, {
      viewId: "student-quiz",
      viewName: "Quiz with every question type",
      role: AUDIT_ROLE.STUDENT,
    });

    await answerAllRenderedQuizQuestionTypesFlow(page, lessons.answers);
    await submitQuizFlow(page);
    quizWasSubmitted = true;
    await expect(page.getByTestId(LEARNING_HANDLES.QUIZ_RETAKE_BUTTON)).toBeEnabled();
    await scanView(page, {
      viewId: "student-quiz-results",
      viewName: "Quiz results",
      role: AUDIT_ROLE.STUDENT,
    });
  });
});

const STUDENT_COMMUNITY_VIEWS: AuditedView[] = [
  {
    viewId: "student-learning-paths",
    viewName: "Learning paths",
    path: "/development-paths",
    ready: (page) => page.getByTestId(LEARNING_PATHS_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "student-calendar",
    viewName: "Calendar",
    path: "/calendar",
    ready: (page) => page.getByTestId(CALENDAR_HANDLES.PAGE),
  },
  {
    viewId: "student-news",
    viewName: "News",
    path: "/news",
    ready: (page) => page.getByTestId(NEWS_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "student-articles",
    viewName: "Articles",
    path: "/articles",
    ready: (page) => page.getByTestId(ARTICLES_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "student-qa",
    viewName: "Q&A",
    path: "/qa",
    ready: (page) => page.getByTestId(QA_PAGE_HANDLES.PAGE),
  },
  {
    viewId: "student-forum",
    viewName: "Forum",
    path: "/forum",
    ready: (page) => page.getByTestId(FORUM_HANDLES.PAGE),
  },
  {
    viewId: "student-leaderboard",
    viewName: "Leaderboard",
    path: "/leaderboards",
    ready: (page) => page.getByTestId(LEADERBOARD_HANDLES.PAGE),
  },
];

test("student community and planning pages", async ({
  cleanup,
  withWorkerPage,
  workerTenantApiClient,
}) => {
  for (const contentModule of ["news", "articles", "qa"] as const) {
    cleanup.add(
      await overrideContentModuleState(workerTenantApiClient, contentModule, { enabled: true }),
    );
  }
  const { forumEnabled } = (
    await workerTenantApiClient.api.settingsControllerGetPublicGlobalSettings()
  ).data.data;
  await setForumFeatureState(workerTenantApiClient, { forumEnabled: true });
  cleanup.add(() => setForumFeatureState(workerTenantApiClient, { forumEnabled }));
  cleanup.add(await overrideLearningPathsEnabled(workerTenantApiClient));
  cleanup.add(
    await ensureLeaderboardFeatures(workerTenantApiClient, {
      gamificationEnabled: true,
      leaderboardsEnabled: true,
    }),
  );

  await withWorkerPage(USER_ROLE.student, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const view of STUDENT_COMMUNITY_VIEWS) {
      await openAndScanView(page, AUDIT_ROLE.STUDENT, view);
    }
  });
});
