import { render, screen } from "@testing-library/react";
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

const renderMatching = (isQuizFeedbackRedacted: boolean) => {
  const Wrapper = ({ children }: PropsWithChildren) => {
    const form = useForm({ defaultValues: getUserAnswers([question]) });

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider isQuizSubmitted isQuizFeedbackRedacted={isQuizFeedbackRedacted}>
          <FormProvider {...form}>{children}</FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(
    <Wrapper>
      <Matching question={question} isCompleted />
    </Wrapper>,
  );
};

describe("Matching", () => {
  it("shows each pair with the learner's locked answer and the correct match for wrong pairs", () => {
    renderMatching(false);

    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);
    selects.forEach((select) => {
      expect(select).toBeDisabled();
      expect(select).toHaveTextContent("Meow");
    });
    expect(screen.getByRole("combobox", { name: "Dog" })).toBeInTheDocument();
    expect(screen.getByText(/Woof/)).toBeInTheDocument();
  });

  it("hides the correct matches when feedback is redacted", () => {
    renderMatching(true);

    expect(screen.queryByText(/Woof/)).not.toBeInTheDocument();
  });
});
