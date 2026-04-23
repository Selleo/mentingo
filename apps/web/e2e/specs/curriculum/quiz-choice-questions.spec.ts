import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { fillChoiceQuestionFlow } from "../../flows/curriculum/fill-choice-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create quiz choice questions", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-choice-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-choice-chapter-${Date.now()}`,
    });
    const lessonTitle = `quiz-choice-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, lessonTitle);

    await addQuizQuestionFlow(page, QuestionType.SINGLE_CHOICE, 0);
    await fillChoiceQuestionFlow(page, {
      questionIndex: 0,
      title: "Single choice?",
      options: ["A", "B"],
      correctIndexes: [0],
    });

    await addQuizQuestionFlow(page, QuestionType.MULTIPLE_CHOICE, 1);
    await fillChoiceQuestionFlow(page, {
      questionIndex: 1,
      title: "Multiple choice?",
      options: ["A", "B", "C"],
      correctIndexes: [0, 2],
    });

    await addQuizQuestionFlow(page, QuestionType.TRUE_OR_FALSE, 2);
    await fillChoiceQuestionFlow(page, {
      questionIndex: 2,
      title: "True or false?",
      options: ["Correct", "Incorrect"],
      correctIndexes: [0],
    });

    await saveQuizLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.questions?.length;
      })
      .toBe(3);
  });
});
