import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { QUIZ_AUTHORING_CASES } from "../../data/curriculum/quiz-authoring.data";
import { expect, test } from "../../fixtures/test.fixture";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { fillQuizQuestionFlow } from "../../flows/curriculum/fill-quiz-question.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { arrangeCurriculumChapter } from "./curriculum-test-helpers";

for (const quizCase of QUIZ_AUTHORING_CASES) {
  test(`admin can author ${quizCase.name} quiz questions`, async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const prefix = `quiz-authoring-${quizCase.name.replaceAll(" ", "-")}-${Date.now()}`;
      const { course, chapter } = await arrangeCurriculumChapter({
        cleanup,
        factories,
        title: prefix,
      });
      const curriculumFactory = factories.createCurriculumFactory();
      const lessonTitle = `${prefix}-lesson`;

      await openCurriculumPageFlow(page, course.id);
      await openNewLessonFormFlow(page, chapter.id, "quiz");
      await fillQuizLessonTitleFlow(page, lessonTitle);

      for (const [questionIndex, question] of quizCase.questions.entries()) {
        await fillQuizQuestionFlow(page, questionIndex, question);
      }

      await saveQuizLessonFormFlow(page);

      await expect
        .poll(async () => {
          const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);

          return [...(lesson?.questions ?? [])]
            .sort((first, second) => (first.displayOrder ?? 0) - (second.displayOrder ?? 0))
            .map((question) => ({
              ...question,
              options: [...(question.options ?? [])].sort(
                (first, second) => (first.displayOrder ?? 0) - (second.displayOrder ?? 0),
              ),
            }));
        })
        .toMatchObject(quizCase.expected);

      const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);
      await expect(
        page.getByTestId(CURRICULUM_HANDLES.lessonTitle(lesson?.id ?? "")),
      ).toContainText(lessonTitle);
    });
  });
}
