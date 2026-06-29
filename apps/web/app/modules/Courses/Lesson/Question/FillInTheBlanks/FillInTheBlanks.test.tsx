import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import { QuizContextProvider } from "~/modules/Courses/components/QuizContextProvider";
import i18next from "~/utils/mocks/i18next.mock";

import { FillInTheBlanksDnd } from "./dnd/FillInTheBlanksDnd";
import { FillInTheBlanks } from "./FillInTheBlanks";

import type { QuizQuestion } from "../types";
import type { PropsWithChildren, ReactNode } from "react";
import type { QuizForm } from "~/modules/Courses/Lesson/types";

vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content, className }: { content: string; className?: string }) => (
    <div className={className} dangerouslySetInnerHTML={{ __html: content }} />
  ),
}));

const renderQuestion = (children: ReactNode) => {
  const Wrapper = ({ children }: PropsWithChildren) => {
    const form = useForm<QuizForm>({
      defaultValues: {
        briefResponses: {},
        detailedResponses: {},
        fillInTheBlanksDnd: {},
        fillInTheBlanksText: {},
        multiAnswerQuestions: {},
        photoQuestionMultipleChoice: {},
        photoQuestionSingleChoice: {},
        singleAnswerQuestions: {},
        trueOrFalseQuestions: {},
      },
    });

    return (
      <I18nextProvider i18n={i18next}>
        <QuizContextProvider isQuizSubmitted={true}>
          <FormProvider {...form}>{children}</FormProvider>
        </QuizContextProvider>
      </I18nextProvider>
    );
  };

  return render(<Wrapper>{children}</Wrapper>);
};

describe("FillInTheBlanks", () => {
  it("shows a derived correct sentence for completed text blanks without solution explanation", () => {
    renderQuestion(
      <FillInTheBlanks
        isCompleted
        question={
          {
            id: "question-1",
            type: "fill_in_the_blanks_text",
            displayOrder: 1,
            description: "The <blank-answer-answer-1> answer.",
            solutionExplanation: null,
            passQuestion: false,
            options: [
              {
                id: "answer-1",
                optionText: "correct",
                displayOrder: 1,
                isCorrect: true,
                isStudentAnswer: false,
                studentAnswer: "wrong",
              },
            ],
          } as QuizQuestion
        }
      />,
    );

    expect(screen.getByText("Correct sentence:")).toBeInTheDocument();
    expect(screen.getByText("correct")).toBeInTheDocument();
  });

  it("shows a derived correct sentence for completed drag-and-drop blanks without solution explanation", () => {
    renderQuestion(
      <FillInTheBlanksDnd
        isCompleted
        question={
          {
            id: "question-2",
            type: "fill_in_the_blanks_dnd",
            displayOrder: 2,
            description: "Drag the <blank-answer-answer-2> answer.",
            solutionExplanation: null,
            passQuestion: false,
            options: [
              {
                id: "answer-2",
                optionText: "correct",
                displayOrder: 1,
                isCorrect: true,
                isStudentAnswer: false,
                studentAnswer: "wrong",
              },
            ],
          } as QuizQuestion
        }
      />,
    );

    expect(screen.getByText("Correct sentence:")).toBeInTheDocument();
    expect(screen.getByText("correct")).toBeInTheDocument();
  });
});
