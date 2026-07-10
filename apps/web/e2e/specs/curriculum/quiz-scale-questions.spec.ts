import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("scale question type is available in the question selector", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-scale-selector-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-scale-chapter-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, `quiz-scale-lesson-${Date.now()}`);
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.ADD_QUESTION_BUTTON).click();

    await expect(
      page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTypeOption(QuestionType.SCALE_1_5)),
    ).toBeVisible();
  });
});

test("admin can create a quiz lesson with a scale question", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-scale-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-scale-chapter-${Date.now()}`,
    });
    const lessonTitle = `quiz-scale-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, lessonTitle);

    await addQuizQuestionFlow(page, QuestionType.SCALE_1_5, 0);
    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(0))
      .fill("How would you rate this lesson?");

    await saveQuizLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.questions?.length;
      })
      .toBe(1);
  });
});
