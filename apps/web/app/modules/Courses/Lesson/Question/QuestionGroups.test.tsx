import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import { QUIZ_ANSWER_FOCUS_RING } from "~/modules/Courses/Lesson/constants";
import {
  getEmptyQuizAnswers,
  getUserAnswers,
  parseQuizFormData,
} from "~/modules/Courses/Lesson/utils";
import i18next from "~/utils/mocks/i18next.mock";

import { Question } from "./Question";
import { makeQuizQuestion, makeQuizQuestionOption } from "./testFactories";

import type { QuizQuestion } from "./types";
import type { Mock } from "vitest";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ isPreviewMode: false }),
}));

const makeOptions = (questionId: string, count: number) =>
  Array.from({ length: count }, (_, index) =>
    makeQuizQuestionOption({
      id: `${questionId}-option-${index + 1}`,
      optionText: `${questionId} answer ${index + 1}`,
      displayOrder: index + 1,
      isCorrect: null,
    }),
  );

const questions = [
  makeQuizQuestion({
    id: "single-1",
    title: "First single choice",
    options: makeOptions("single-1", 3),
  }),
  makeQuizQuestion({
    id: "single-2",
    title: "Second single choice",
    displayOrder: 2,
    options: makeOptions("single-2", 3),
  }),
  makeQuizQuestion({
    id: "true-false",
    type: "true_or_false",
    title: "True or false",
    displayOrder: 3,
    options: makeOptions("true-false", 2),
  }),
  makeQuizQuestion({
    id: "multi",
    type: "multiple_choice",
    title: "Multiple choice",
    displayOrder: 4,
    options: makeOptions("multi", 2),
  }),
  makeQuizQuestion({
    id: "photo-single",
    type: "photo_question_single_choice",
    title: "Photo single choice",
    displayOrder: 5,
    options: makeOptions("photo-single", 3),
  }),
  makeQuizQuestion({
    id: "photo-multi",
    type: "photo_question_multiple_choice",
    title: "Photo multiple choice",
    displayOrder: 6,
    options: makeOptions("photo-multi", 3),
  }),
];

const pickedOptionIds = new Set([
  "single-1-option-2",
  "single-2-option-1",
  "multi-option-1",
  "photo-single-option-3",
  "photo-multi-option-2",
]);
const trueOrFalseAnswers: Record<string, string> = {
  "true-false-option-1": "true",
  "true-false-option-2": "false",
};

// The same quiz after grading: every picked option is correct except single-2, whose answer is option 3.
const gradedQuestions = questions.map((question) =>
  makeQuizQuestion({
    ...question,
    options: question.options?.map((option) => {
      const isPicked = pickedOptionIds.has(option.id);

      return makeQuizQuestionOption({
        ...option,
        isStudentAnswer: isPicked,
        studentAnswer: trueOrFalseAnswers[option.id] ?? null,
        isCorrect:
          option.id === "single-2-option-3" || (isPicked && option.id !== "single-2-option-1"),
      });
    }),
  }),
);

type RenderQuizOptions = {
  quizQuestions?: QuizQuestion[];
  isCompleted?: boolean;
  onSubmit?: (values: QuizForm) => void;
};

const renderQuiz = ({
  quizQuestions = questions,
  isCompleted = false,
  onSubmit = vi.fn(),
}: RenderQuizOptions = {}) => {
  const QuizForm = () => {
    // Mirrors Quiz.tsx: a retake shows the ungraded questions again and resets to empty answers.
    const [isRetaking, setIsRetaking] = useState(false);
    const isShowingGraded = isCompleted && !isRetaking;
    const shownQuestions = isRetaking ? questions : quizQuestions;
    const form = useForm<QuizForm>({
      defaultValues: isCompleted
        ? getUserAnswers(quizQuestions)
        : getEmptyQuizAnswers(quizQuestions),
    });

    const retake = () => {
      setIsRetaking(true);
      form.reset(getEmptyQuizAnswers(questions));
    };

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider isQuizSubmitted={isShowingGraded}>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {shownQuestions.map((question) => (
                <Question
                  key={question.id}
                  question={question}
                  isCompleted={isShowingGraded}
                  lessonId="l"
                />
              ))}
              <button type="submit">submit</button>
              <button type="button" onClick={retake}>
                retake
              </button>
            </form>
          </FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(<QuizForm />);
};

const getQuestionGroup = (title: string) => screen.getByRole("group", { name: title });

const getStatementRadios = (statement: string) =>
  within(screen.getByRole("radiogroup", { name: statement })).getAllByRole("radio");

const submitAndParse = async (user: ReturnType<typeof userEvent.setup>, onSubmit: Mock) => {
  await user.click(screen.getByRole("button", { name: "submit" }));

  const [submittedValues] = onSubmit.mock.calls[0];

  return parseQuizFormData(submittedValues);
};

const expectOnlyChecked = (inputs: HTMLElement[], checkedIndexes: number[]) =>
  inputs.forEach((input, index) =>
    checkedIndexes.includes(index) ? expect(input).toBeChecked() : expect(input).not.toBeChecked(),
  );

describe("quiz answers grouped per question", () => {
  it("labels each question group with its text and counts options within it", () => {
    renderQuiz();

    const firstRadios = within(getQuestionGroup("First single choice")).getAllByRole("radio");
    const secondRadios = within(getQuestionGroup("Second single choice")).getAllByRole("radio");
    const checkboxes = within(getQuestionGroup("Multiple choice")).getAllByRole("checkbox");

    expect(firstRadios).toHaveLength(3);
    expect(secondRadios).toHaveLength(3);
    expect(checkboxes).toHaveLength(2);
    expect(new Set(firstRadios.map((radio) => radio.getAttribute("name"))).size).toBe(1);
    expect(new Set(secondRadios.map((radio) => radio.getAttribute("name"))).size).toBe(1);
    expect(firstRadios[0]).not.toHaveAttribute("name", secondRadios[0].getAttribute("name"));
  });

  it("groups each true/false statement under the question with a unique name", () => {
    renderQuiz();

    const trueFalseGroup = getQuestionGroup("True or false");
    const firstStatement = within(trueFalseGroup).getByRole("radiogroup", {
      name: "true-false answer 1",
    });
    const secondStatement = within(trueFalseGroup).getByRole("radiogroup", {
      name: "true-false answer 2",
    });
    const firstStatementRadios = within(firstStatement).getAllByRole("radio");
    const secondStatementRadios = within(secondStatement).getAllByRole("radio");

    expect(firstStatementRadios).toHaveLength(2);
    expect(new Set(firstStatementRadios.map((radio) => radio.getAttribute("name"))).size).toBe(1);
    expect(firstStatementRadios[0]).not.toHaveAttribute(
      "name",
      secondStatementRadios[0].getAttribute("name"),
    );
  });

  it("moves with arrow keys only within the current question", async () => {
    const user = userEvent.setup();

    renderQuiz();

    const firstRadios = within(getQuestionGroup("First single choice")).getAllByRole("radio");
    const secondRadios = within(getQuestionGroup("Second single choice")).getAllByRole("radio");

    await user.click(firstRadios[2]);
    await user.keyboard("{ArrowDown}");

    expect(firstRadios[0]).toBeChecked();
    expect(firstRadios[0]).toHaveFocus();
    secondRadios.forEach((radio) => expect(radio).not.toBeChecked());
  });

  it("submits the same answers as before", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderQuiz({ onSubmit });

    await user.click(within(getQuestionGroup("First single choice")).getAllByRole("radio")[0]);
    await user.click(within(getQuestionGroup("First single choice")).getAllByRole("radio")[1]);
    await user.click(within(getQuestionGroup("Second single choice")).getAllByRole("radio")[2]);
    await user.click(
      within(screen.getByRole("radiogroup", { name: "true-false answer 1" })).getAllByRole(
        "radio",
      )[1],
    );
    await user.click(within(getQuestionGroup("Multiple choice")).getAllByRole("checkbox")[0]);
    await user.click(screen.getByRole("button", { name: "submit" }));

    const [submittedValues] = onSubmit.mock.calls[0];

    expect(parseQuizFormData(submittedValues)).toEqual([
      { questionId: "single-1", answers: [{ answerId: "single-1-option-2" }] },
      { questionId: "single-2", answers: [{ answerId: "single-2-option-3" }] },
      { questionId: "multi", answers: [{ answerId: "multi-option-1" }] },
      { questionId: "true-false", answers: [{ answerId: "true-false-option-1", value: "false" }] },
    ]);
  });
  it("labels each question group with its answering instruction", () => {
    renderQuiz();

    expect(getQuestionGroup("First single choice")).toHaveAccessibleDescription(
      i18next.t("studentLessonView.other.singleChoice"),
    );
    expect(getQuestionGroup("Multiple choice")).toHaveAccessibleDescription(
      i18next.t("studentLessonView.other.multipleChoice"),
    );
  });

  it("submits an answer picked with the arrow keys", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderQuiz({ onSubmit });

    await user.click(within(getQuestionGroup("Second single choice")).getAllByRole("radio")[0]);
    await user.keyboard("{ArrowDown}");

    expect(await submitAndParse(user, onSubmit)).toContainEqual({
      questionId: "single-2",
      answers: [{ answerId: "single-2-option-2" }],
    });
  });

  it("groups and submits photo questions like their plain counterparts", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderQuiz({ onSubmit });

    const photoRadios = within(getQuestionGroup("Photo single choice")).getAllByRole("radio");
    const photoCheckboxes = within(getQuestionGroup("Photo multiple choice")).getAllByRole(
      "checkbox",
    );

    expect(photoRadios).toHaveLength(3);
    photoRadios.forEach((radio) =>
      expect(radio).toHaveAttribute("name", "photoQuestionSingleChoice.photo-single"),
    );
    expect(photoCheckboxes).toHaveLength(3);

    await user.click(photoRadios[2]);
    await user.click(photoCheckboxes[0]);
    await user.click(photoCheckboxes[2]);

    const payload = await submitAndParse(user, onSubmit);

    expect(payload).toContainEqual({
      questionId: "photo-single",
      answers: [{ answerId: "photo-single-option-3" }],
    });
    expect(payload).toContainEqual({
      questionId: "photo-multi",
      answers: [{ answerId: "photo-multi-option-1" }, { answerId: "photo-multi-option-3" }],
    });
  });

  it("tabs from a checked answer to the next question, not to a sibling radio", async () => {
    const user = userEvent.setup();

    renderQuiz();

    await user.click(within(getQuestionGroup("First single choice")).getAllByRole("radio")[1]);
    await user.tab();

    expect(within(getQuestionGroup("Second single choice")).getAllByRole("radio")[0]).toHaveFocus();
  });

  it("marks the answer that has keyboard focus, in every choice question type", () => {
    renderQuiz();

    const answers = [...screen.getAllByRole("radio"), ...screen.getAllByRole("checkbox")];
    const answerLabels = answers.map((answer) => answer.closest("label"));

    // jsdom has no :focus-visible, so check the card carries the keyboard-only ring utilities.
    answerLabels.forEach((label) => expect(label).toHaveClass(QUIZ_ANSWER_FOCUS_RING));
  });

  describe("after the quiz is graded", () => {
    const gradedPayload = [
      { questionId: "single-1", answers: [{ answerId: "single-1-option-2" }] },
      { questionId: "single-2", answers: [{ answerId: "single-2-option-1" }] },
      { questionId: "photo-single", answers: [{ answerId: "photo-single-option-3" }] },
      { questionId: "multi", answers: [{ answerId: "multi-option-1" }] },
      { questionId: "photo-multi", answers: [{ answerId: "photo-multi-option-2" }] },
      {
        questionId: "true-false",
        answers: [
          { answerId: "true-false-option-1", value: "true" },
          { answerId: "true-false-option-2", value: "false" },
        ],
      },
    ];

    it("checks only the student's answers", () => {
      renderQuiz({ quizQuestions: gradedQuestions, isCompleted: true });

      expectOnlyChecked(within(getQuestionGroup("First single choice")).getAllByRole("radio"), [1]);
      expectOnlyChecked(within(getQuestionGroup("Second single choice")).getAllByRole("radio"), [
        0,
      ]);
      expectOnlyChecked(getStatementRadios("true-false answer 1"), [0]);
      expectOnlyChecked(getStatementRadios("true-false answer 2"), [1]);
      expectOnlyChecked(within(getQuestionGroup("Multiple choice")).getAllByRole("checkbox"), [0]);
      expectOnlyChecked(within(getQuestionGroup("Photo single choice")).getAllByRole("radio"), [2]);
      expectOnlyChecked(
        within(getQuestionGroup("Photo multiple choice")).getAllByRole("checkbox"),
        [1],
      );
    });

    it("keeps the answers fixed under arrow keys and Space", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderQuiz({ quizQuestions: gradedQuestions, isCompleted: true, onSubmit });

      const singleRadios = within(getQuestionGroup("First single choice")).getAllByRole("radio");
      const statementRadios = getStatementRadios("true-false answer 1");
      const checkboxes = within(getQuestionGroup("Multiple choice")).getAllByRole("checkbox");

      act(() => singleRadios[1].focus());
      await user.keyboard("{ArrowDown}");
      expectOnlyChecked(singleRadios, [1]);

      act(() => statementRadios[0].focus());
      await user.keyboard("{ArrowRight}");
      expectOnlyChecked(statementRadios, [0]);

      act(() => checkboxes[0].focus());
      await user.keyboard(" ");
      expectOnlyChecked(checkboxes, [0]);

      expect(await submitAndParse(user, onSubmit)).toEqual(gradedPayload);
    });

    it("re-enables the answers for a retake and submits the new ones", async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      renderQuiz({ quizQuestions: gradedQuestions, isCompleted: true, onSubmit });

      expect(
        within(getQuestionGroup("First single choice")).getAllByRole("radio")[0],
      ).toBeDisabled();

      await user.click(screen.getByRole("button", { name: "retake" }));

      const singleRadios = within(getQuestionGroup("First single choice")).getAllByRole("radio");
      const statementRadios = getStatementRadios("true-false answer 1");
      const checkboxes = within(getQuestionGroup("Multiple choice")).getAllByRole("checkbox");

      [...singleRadios, ...statementRadios, ...checkboxes].forEach((input) =>
        expect(input).toBeEnabled(),
      );

      await user.click(singleRadios[0]);
      await user.click(statementRadios[1]);
      await user.click(checkboxes[1]);

      expect(await submitAndParse(user, onSubmit)).toEqual([
        { questionId: "single-1", answers: [{ answerId: "single-1-option-1" }] },
        { questionId: "multi", answers: [{ answerId: "multi-option-2" }] },
        {
          questionId: "true-false",
          answers: [{ answerId: "true-false-option-1", value: "false" }],
        },
      ]);
    });
  });
});
