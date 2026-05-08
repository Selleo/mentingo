import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { COURSE_STATISTICS_HANDLES } from "../../data/statistics/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { waitForUserQuizAttemptCountFlow } from "../../flows/learning/wait-for-quiz-attempt-count.flow";
import { openCourseStatisticsTabFlow } from "../../flows/statistics/open-course-statistics-tab.flow";
import { openCourseStatisticsFlow } from "../../flows/statistics/open-course-statistics.flow";
import { searchCourseStatisticsFlow } from "../../flows/statistics/search-course-statistics.flow";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

test("admin can view course statistics overview, progress, quiz results and filters", async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
}) => {
  const enrollmentFactory = factories.createEnrollmentFactory();
  const groupFactory = factories.createGroupFactory();
  const userFactory = factories.createUserFactory();
  let quizWasSubmitted = false;

  const { courseId, lessons } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix: `statistics-course-${Date.now()}`,
    shouldKeepCourseAfterTest: () => quizWasSubmitted,
    withWorkerPage,
  });
  const { quizLesson } = lessons;

  let studentId = "";
  let studentName = "";

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      const currentUser = (await apiClient.api.authControllerCurrentUser()).data.data;
      studentId = currentUser.id;
      studentName = `${currentUser.firstName} ${currentUser.lastName}`;

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);
      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
      quizWasSubmitted = true;

      await waitForUserQuizAttemptCountFlow(apiClient, 1);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.admin,
    async ({ page }) => {
      const group = await groupFactory.create({
        name: `statistics-group-${Date.now()}`,
      });

      cleanup.add(async () => {
        await withWorkerPage(
          USER_ROLE.admin,
          async () => {
            await enrollmentFactory.unenrollGroups(courseId, [group.id]);
            await userFactory.update(studentId, {
              groups: [],
              roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
            });
            await groupFactory.delete(group.id);
          },
          { root: true },
        );
      });

      await userFactory.update(studentId, {
        groups: [group.id],
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      });
      await enrollmentFactory.enrollGroups(courseId, [
        { id: group.id, isMandatory: false, dueDate: null },
      ]);

      await expect
        .poll(async () => {
          const [overview, progress, groupProgress, quizResults] = await Promise.all([
            apiClient.api.courseControllerGetCourseStatistics(courseId),
            apiClient.api.courseControllerGetCourseStudentsProgress(courseId, {
              language: "en",
              perPage: 100,
            }),
            apiClient.api.courseControllerGetCourseStudentsProgress(courseId, {
              groupId: group.id,
              language: "en",
              perPage: 100,
            }),
            apiClient.api.courseControllerGetCourseStudentsQuizResults(courseId, {
              language: "en",
              perPage: 100,
            }),
          ]);

          return {
            enrolledCount: overview.data.data.enrolledCount,
            progressRow: progress.data.data.some((row) => row.studentId === studentId),
            groupProgressRow: groupProgress.data.data.some((row) => row.studentId === studentId),
            quizRow: quizResults.data.data.some(
              (row) => row.studentId === studentId && row.lessonId === quizLesson.id,
            ),
          };
        })
        .toEqual({
          enrolledCount: 1,
          progressRow: true,
          groupProgressRow: true,
          quizRow: true,
        });

      await openCourseStatisticsFlow(page, courseId);

      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.OVERVIEW_ENROLLED_COUNT_CARD),
      ).toContainText("1");
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.OVERVIEW_COMPLETION_RATE_CARD),
      ).toContainText("100%");
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.progressRow(studentId)),
      ).toBeVisible();
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.progressRow(studentId)),
      ).toContainText(studentName);

      await page.getByTestId(COURSE_STATISTICS_HANDLES.GROUP_FILTER).click();
      await page.getByTestId(COURSE_STATISTICS_HANDLES.groupFilterOption(group.id)).click();
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.progressRow(studentId)),
      ).toBeVisible();

      await page.getByTestId(COURSE_STATISTICS_HANDLES.GROUP_FILTER).click();
      await page.getByTestId(COURSE_STATISTICS_HANDLES.groupFilterOption("all")).click();
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.progressRow(studentId)),
      ).toBeVisible();

      await searchCourseStatisticsFlow(page, studentName);
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.progressRow(studentId)),
      ).toBeVisible();

      await openCourseStatisticsTabFlow(page, "quizResults");
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.quizResultsRow(studentId, quizLesson.id)),
      ).toBeVisible();
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.quizResultsRow(studentId, quizLesson.id)),
      ).toContainText(quizLesson.title);

      await page.getByTestId(COURSE_STATISTICS_HANDLES.QUIZ_FILTER).click();
      await page.getByTestId(COURSE_STATISTICS_HANDLES.quizFilterOption(quizLesson.id)).click();
      await expect(
        page.getByTestId(COURSE_STATISTICS_HANDLES.quizResultsRow(studentId, quizLesson.id)),
      ).toBeVisible();
      await expect(
        page.getByTestId(
          COURSE_STATISTICS_HANDLES.quizResultsPreviewButton(studentId, quizLesson.id),
        ),
      ).toBeVisible();

      await openCourseStatisticsTabFlow(page, "learningTime");
      await expect(page.getByTestId(COURSE_STATISTICS_HANDLES.LEARNING_TIME_TABLE)).toBeVisible();
    },
    { root: true },
  );
});
