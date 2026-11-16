import { render, screen, within } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import { getUserAnswers } from "~/modules/Courses/Lesson/utils";
import i18next from "~/utils/mocks/i18next.mock";

import { Matching, placeMatch } from "./Matching";
import { makeQuizQuestion, makeQuizQuestionOption } from "./testFactories";

import type { PropsWithChildren } from "react";

const question = makeQuizQuestion({
  type: "matching",
  title: "Match the animal with its sound",
  matchingTargets: ["Woof", "", "Meow"],
  options: [
    makeQuizQuestionOption({
      id: "pair-cat",
      optionText: "Cat",
      isStudentAnswer: true,
      studentAnswer: "Meow",
      isCorrect: true,
      matchedWord: "Meow",
    }),
    makeQuizQuestionOption({
      id: "pair-dog",
      optionText: "Dog",
      displayOrder: 2,
      isStudentAnswer: true,
      studentAnswer: "Meow",
      isCorrect: false,
      matchedWord: "Woof",
    }),
  ],
});

type RenderOptions = { isCompleted: boolean; isQuizFeedbackRedacted?: boolean };

const renderMatching = (
  { isCompleted, isQuizFeedbackRedacted = false }: RenderOptions,
  testQuestion = question,
) => {
  const Wrapper = ({ children }: PropsWithChildren) => {
    const form = useForm({
      defaultValues: isCompleted
        ? getUserAnswers([testQuestion])
        : { matchingQuestions: { [testQuestion.id]: { "pair-cat": "Woof", "pair-dog": null } } },
    });

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
      <Matching question={testQuestion} isCompleted={isCompleted} />
    </Wrapper>,
  );
};

describe("placeMatch", () => {
  const answers = { cat: "Meow", dog: null, cow: "Moo" };

  it("places a match from the bank on an empty pair", () => {
    expect(placeMatch({ cat: null, dog: null }, "Woof", "dog")).toEqual({
      cat: null,
      dog: "Woof",
    });
  });

  it("swaps matches when dropping on a pair that already has one", () => {
    expect(placeMatch(answers, "Meow", "cow")).toEqual({ cat: "Moo", dog: null, cow: "Meow" });
  });

  it("sends the replaced match back to the bank when the dragged one comes from the bank", () => {
    expect(placeMatch(answers, "Woof", "cat")).toEqual({ cat: "Woof", dog: null, cow: "Moo" });
  });

  it("returns a placed match to the bank", () => {
    expect(placeMatch(answers, "Meow", null)).toEqual({ cat: null, dog: null, cow: "Moo" });
  });
});

describe("Matching", () => {
  it("shows placed matches in their pairs and the rest in the answer bank", () => {
    renderMatching({ isCompleted: false });

    expect(within(screen.getByTestId("pair-cat")).getByText("Woof")).toBeInTheDocument();
    const bank = screen.getByTestId("blank_preset");

    expect(within(bank).getByText("Meow")).toBeInTheDocument();
    expect(within(bank).queryByText("Woof")).not.toBeInTheDocument();
  });

  it("shows a placed match in the pair's labelled combobox and keeps bank matches as chips", () => {
    renderMatching({ isCompleted: false });

    const trigger = within(screen.getByTestId("pair-cat")).getByRole("combobox");

    expect(trigger).toHaveTextContent("Woof");
    expect(trigger).toHaveAccessibleName("Cat, Woof");
    // Same plain look as fill-in-the-blanks: the pair name is announced, not shown.
    expect(trigger).toHaveClass("[&>svg]:hidden");
    expect(within(screen.getByTestId("pair-dog")).getByRole("combobox").textContent).toBe("");

    const bankMatch = within(screen.getByTestId("blank_preset")).getByText("Meow");

    expect(bankMatch).toHaveClass("w-auto", "text-left");
  });

  it("shows the click-to-choose instruction while answering", () => {
    renderMatching({ isCompleted: false });

    expect(
      screen.getByText(i18next.t("studentLessonView.other.matchingInstruction")),
    ).toBeInTheDocument();
  });

  it("shows the learner's answers and the correct match for wrong pairs", () => {
    renderMatching({ isCompleted: true });

    expect(within(screen.getByTestId("pair-cat")).getByText("Meow")).toBeInTheDocument();
    expect(within(screen.getByTestId("pair-dog")).getByText("Meow")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("matching-pair-pair-dog")).getByText(/Woof/),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("blank_preset")).not.toBeInTheDocument();
  });

  it("hides the correct matches when feedback is redacted", () => {
    renderMatching({ isCompleted: true, isQuizFeedbackRedacted: true });

    expect(screen.queryByText(/Woof/)).not.toBeInTheDocument();
  });

  it("says no matches are available when the question is untranslated", () => {
    renderMatching({ isCompleted: false }, { ...question, matchingTargets: [] });

    expect(screen.queryByTestId("blank_preset")).not.toBeInTheDocument();
    expect(
      screen.getByText(i18next.t("studentLessonView.other.noMatchesAvailable")),
    ).toBeInTheDocument();
  });
});
