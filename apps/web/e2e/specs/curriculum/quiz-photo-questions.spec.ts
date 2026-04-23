import { existsSync } from "node:fs";

import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { fillPhotoQuestionFlow } from "../../flows/curriculum/fill-photo-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test.skip(
  !existsSync(CURRICULUM_TEST_DATA.files.quizPhotoSingleChoice) ||
    !existsSync(CURRICULUM_TEST_DATA.files.quizPhotoMultipleChoice),
  "Quiz photo fixtures are not present",
);

test("admin can create photo quiz questions", async ({ cleanup, factories, withWorkerPage }) => {
  await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
    const { category, course, categoryFactory, courseFactory } = await createCurriculumCourse(
      factories,
      `curriculum-quiz-photo-${Date.now()}`,
    );
    const curriculumFactory = factories.createCurriculumFactory();
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `quiz-photo-chapter-${Date.now()}`,
    });
    const lessonTitle = `quiz-photo-lesson-${Date.now()}`;

    cleanup.add(async () => {
      await courseFactory.delete(course.id);
      await categoryFactory.delete(category.id);
    });

    await openCurriculumPageFlow(page, course.id);
    await openNewLessonFormFlow(page, chapter.id, "quiz");
    await fillQuizLessonTitleFlow(page, lessonTitle);

    await addQuizQuestionFlow(page, QuestionType.PHOTO_QUESTION_SINGLE_CHOICE, 0);
    await fillPhotoQuestionFlow(page, {
      questionIndex: 0,
      title: "Photo single choice",
      imagePath: CURRICULUM_TEST_DATA.files.quizPhotoSingleChoice,
      type: QuestionType.PHOTO_QUESTION_SINGLE_CHOICE,
      options: ["A", "B"],
      correctIndexes: [0],
    });

    await addQuizQuestionFlow(page, QuestionType.PHOTO_QUESTION_SINGLE_CHOICE, 1);
    await fillPhotoQuestionFlow(page, {
      questionIndex: 1,
      title: "Photo multiple choice",
      imagePath: CURRICULUM_TEST_DATA.files.quizPhotoMultipleChoice,
      type: QuestionType.PHOTO_QUESTION_MULTIPLE_CHOICE,
      options: ["A", "B", "C"],
      correctIndexes: [0, 2],
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
