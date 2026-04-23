import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("scale and match words question types are unavailable", async ({
  cleanup,
  factories,
  withReadonlyPage,
}) => {
  await withReadonlyPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-disabled-questions-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `disabled-questions-chapter-${Date.now()}`,
    });

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, `disabled-questions-lesson-${Date.now()}`);
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.ADD_QUESTION_BUTTON).click();

    await expect(
      page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTypeOption(QuestionType.SCALE_1_5)),
    ).toHaveCount(0);
    await expect(
      page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTypeOption(QuestionType.MATCH_WORDS)),
    ).toHaveCount(0);
  });
});
