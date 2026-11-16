import { render, screen, within } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import i18next from "~/utils/mocks/i18next.mock";

import { makeQuizQuestion, makeQuizQuestionOption } from "../../testFactories";

import { FillInTheBlanksDnd } from "./FillInTheBlanksDnd";

import type { PropsWithChildren } from "react";

const question = makeQuizQuestion({
  type: "fill_in_the_blanks_dnd",
  description: "The quick <blank-answer-opt-1> jumps over the lazy <blank-answer-opt-2>.",
  options: [
    makeQuizQuestionOption({ id: "opt-1", optionText: "brown", displayOrder: 1, isCorrect: true }),
    makeQuizQuestionOption({ id: "opt-2", optionText: "dog", displayOrder: 2, isCorrect: true }),
  ],
});

const renderDnd = () => {
  const Wrapper = ({ children }: PropsWithChildren) => {
    const form = useForm({
      defaultValues: { fillInTheBlanksDnd: { [question.id]: { "opt-1": null, "opt-2": null } } },
    });

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider isQuizSubmitted={false} isQuizFeedbackRedacted={false}>
          <FormProvider {...form}>{children}</FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(
    <Wrapper>
      <FillInTheBlanksDnd question={question} isCompleted={false} />
    </Wrapper>,
  );
};

describe("FillInTheBlanksDnd", () => {
  it("renders each blank as a numbered combobox with the click-to-choose instruction", () => {
    renderDnd();

    expect(
      screen.getByText(i18next.t("studentLessonView.other.fillInTheBlanksInstruction")),
    ).toBeInTheDocument();

    const blanks = screen.getAllByRole("combobox");

    expect(blanks).toHaveLength(2);
    expect(blanks[0]).toHaveAccessibleName(
      i18next.t("studentLessonView.other.blankLabel", { current: 1, total: 2 }),
    );
    expect(blanks[1]).toHaveAccessibleName(
      i18next.t("studentLessonView.other.blankLabel", { current: 2, total: 2 }),
    );
  });

  it("keeps the unplaced words in the answer bank", () => {
    renderDnd();

    const bank = within(screen.getByTestId("blank_preset"));

    expect(bank.getByText("brown")).toBeInTheDocument();
    expect(bank.getByText("dog")).toBeInTheDocument();
  });
});
