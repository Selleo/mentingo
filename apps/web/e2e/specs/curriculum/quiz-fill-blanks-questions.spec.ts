import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { fillFillBlanksQuestionFlow } from "../../flows/curriculum/fill-fill-blanks-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can create fill-in-the-blanks quiz questions", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-blanks-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-blanks-chapter-${Date.now()}`,
    });
    const lessonTitle = `quiz-blanks-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, lessonTitle);

    await addQuizQuestionFlow(page, QuestionType.FILL_IN_THE_BLANKS_TEXT, 0);
    await fillFillBlanksQuestionFlow(page, {
      questionIndex: 0,
      title: "Fill text blanks",
      sentence: "The capital of France is Paris.",
      words: ["Paris"],
    });

    await addQuizQuestionFlow(page, QuestionType.FILL_IN_THE_BLANKS_DND, 1);
    await fillFillBlanksQuestionFlow(page, {
      questionIndex: 1,
      title: "Fill drag blanks",
      sentence: "Drag the correct word into the sentence.",
      words: ["correct"],
    });

    await saveQuizLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.questions?.length;
      })
      .toBe(2);
  });
});
