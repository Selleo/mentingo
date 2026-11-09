import { fireEvent, render, screen, within } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import { getUserAnswers } from "~/modules/Courses/Lesson/utils";
import i18next from "~/utils/mocks/i18next.mock";

import { Matching } from "./Matching";

import type { QuizQuestion } from "./types";
import type { PropsWithChildren } from "react";

const question = {
  id: "question-1",
  type: "matching",
  title: "Match the animal with its sound",
  displayOrder: 1,
  solutionExplanation: null,
  passQuestion: false,
  matchingTargets: ["Woof", "", "Meow"],
  options: [
    {
      id: "pair-cat",
      optionText: "Cat",
      displayOrder: 1,
      isStudentAnswer: true,
      studentAnswer: "Meow",
      isCorrect: true,
      matchedWord: "Meow",
    },
    {
      id: "pair-dog",
      optionText: "Dog",
      displayOrder: 2,
      isStudentAnswer: true,
      studentAnswer: "Meow",
      isCorrect: false,
      matchedWord: "Woof",
    },
  ],
} as QuizQuestion;

let formValues: () => unknown = () => undefined;

const renderMatching = (isQuizFeedbackRedacted: boolean, isCompleted = true) => {
  const Wrapper = ({ children }: PropsWithChildren) => {
    const form = useForm({
      defaultValues: isCompleted
        ? getUserAnswers([question])
        : { matchingQuestions: { [question.id]: { "pair-cat": null, "pair-dog": null } } },
    });
    formValues = () => form.getValues("matchingQuestions");

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider
          isQuizSubmitted={isCompleted}
          isQuizFeedbackRedacted={isQuizFeedbackRedacted}
        >
          <FormProvider {...form}>{children}</FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(
    <Wrapper>
      <Matching question={question} isCompleted={isCompleted} />
    </Wrapper>,
  );
};

describe("Matching", () => {
  it("shows each pair with the learner's locked answer and the correct match for wrong pairs", () => {
    renderMatching(false);

    ["pair-cat", "pair-dog"].forEach((pairId) => {
      const answer = within(screen.getByTestId(`matching-pair-${pairId}`)).getByRole("button", {
        name: "Meow",
      });
      expect(answer).toBeDisabled();
    });
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Woof/)).toBeInTheDocument();
  });

  it("hides the correct matches when feedback is redacted", () => {
    renderMatching(true);

    expect(screen.queryByText(/Woof/)).not.toBeInTheDocument();
  });

  it("places, moves and removes matches without drag and drop", () => {
    renderMatching(false, false);

    fireEvent.click(screen.getByRole("button", { name: "Meow" }));
    fireEvent.click(screen.getByRole("button", { name: "Cat" }));
    expect(formValues()).toEqual({ [question.id]: { "pair-cat": "Meow", "pair-dog": null } });

    fireEvent.click(screen.getByRole("button", { name: "Woof" }));
    fireEvent.click(screen.getByRole("button", { name: "Dog" }));
    expect(formValues()).toEqual({ [question.id]: { "pair-cat": "Meow", "pair-dog": "Woof" } });

    fireEvent.click(within(screen.getByTestId("matching-pair-pair-cat")).getAllByRole("button")[1]);
    expect(formValues()).toEqual({ [question.id]: { "pair-cat": null, "pair-dog": "Woof" } });
    expect(screen.getByRole("button", { name: "Meow" })).toBeInTheDocument();
  });
});
