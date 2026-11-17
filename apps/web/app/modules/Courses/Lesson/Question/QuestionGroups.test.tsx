import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import { getEmptyQuizAnswers, parseQuizFormData } from "~/modules/Courses/Lesson/utils";
import i18next from "~/utils/mocks/i18next.mock";

import { Question } from "./Question";
import { makeQuizQuestion, makeQuizQuestionOption } from "./testFactories";

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
];

const renderQuiz = (onSubmit: (values: QuizForm) => void = vi.fn()) => {
  const QuizForm = () => {
    const form = useForm<QuizForm>({ defaultValues: getEmptyQuizAnswers(questions) });

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              {questions.map((question) => (
                <Question key={question.id} question={question} isCompleted={false} lessonId="l" />
              ))}
              <button type="submit">submit</button>
            </form>
          </FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(<QuizForm />);
};

const getQuestionGroup = (title: string) => screen.getByRole("group", { name: title });

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

    renderQuiz(onSubmit);

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
});
