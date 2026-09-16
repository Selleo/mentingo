import { USER_ROLE } from "~/config/userRoles";
import { QuestionType } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/QuizLessonForm/QuizLessonForm.types";

import { QUIZ_LESSON_FORM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { addQuizQuestionFlow } from "../../flows/curriculum/add-quiz-question.flow";
import { ensureQuizQuestionBodyFlow } from "../../flows/curriculum/ensure-quiz-question-body.flow";
import { fillChoiceQuestionFlow } from "../../flows/curriculum/fill-choice-question.flow";
import { fillQuizLessonTitleFlow } from "../../flows/curriculum/fill-quiz-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openExistingLessonFlow } from "../../flows/curriculum/open-existing-lesson.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { saveQuizLessonFormFlow } from "../../flows/curriculum/save-quiz-lesson-form.flow";

import { createCurriculumCourse } from "./curriculum-test-helpers";

test("admin can configure quiz ordering, dates, duration and feedback", async ({
  cleanup,
  factories,
  withWorkerPage,
}) => {
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

    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.questionFeedbackInput(0))
      .fill("First question explanation");

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

    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("shuffleQuestions")).check();
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("shuffleAnswers")).check();
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("timeLimitMinutes")).fill("10");
    await expect(page.locator("#quizCooldownInHours")).toBeVisible();
    for (const name of ["availableFrom", "availableUntil"]) {
      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput(name)).click();
      await page.getByRole("gridcell", { name: "15", exact: true }).first().click();
      await page.keyboard.press("Escape");
      await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput(`${name}Time`)).click();
      await page
        .getByRole("option", { name: name === "availableFrom" ? "09:00" : "18:00", exact: true })
        .click();
    }
    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("passedFeedback"))
      .fill("Passed message");
    await page
      .getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("failedFeedback"))
      .fill("Failed message");
    await saveQuizLessonFormFlow(page);

    await expect
      .poll(async () => {
        const updatedCourse = await courseFactory.getById(course.id);
        return updatedCourse.chapters[0]?.lessons?.find((lesson) => lesson.title === lessonTitle)
          ?.questions?.length;
      })
      .toBe(3);
    const updated = await courseFactory.getById(course.id);
    const saved = updated.chapters[0].lessons?.find((lesson) => lesson.title === lessonTitle);
    expect(saved?.quizSettings).toMatchObject({
      shuffleQuestions: true,
      shuffleAnswers: true,
      timeLimitMinutes: 10,
      passedFeedback: "Passed message",
      failedFeedback: "Failed message",
    });
    expect(saved?.questions?.[0].feedback).toBe("First question explanation");
    await openExistingLessonFlow(page, chapter.id, saved!.id);
    await expect(
      page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("shuffleQuestions")),
    ).toBeChecked();
    await expect(
      page.getByTestId(QUIZ_LESSON_FORM_HANDLES.settingInput("timeLimitMinutes")),
    ).toHaveValue("10");
    await ensureQuizQuestionBodyFlow(page, 0, QUIZ_LESSON_FORM_HANDLES.questionFeedbackInput(0));
    await expect(page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionFeedbackInput(0))).toHaveValue(
      "First question explanation",
    );
    await page.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionFeedbackInput(0)).fill("");
    await saveQuizLessonFormFlow(page);
    await expect
      .poll(
        async () =>
          (await courseFactory.getById(course.id)).chapters[0].lessons?.find(
            (lesson) => lesson.id === saved!.id,
          )?.questions?.[0].feedback,
      )
      .toBe("");
  });
});
