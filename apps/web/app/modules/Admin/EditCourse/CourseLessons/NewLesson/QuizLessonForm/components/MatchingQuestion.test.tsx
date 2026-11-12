import { zodResolver } from "@hookform/resolvers/zod";
import { act, screen } from "@testing-library/react";
import i18next from "i18next";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { Form } from "~/components/ui/form";
import { renderWith } from "~/utils/testUtils";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { QuestionType } from "../QuizLessonForm.types";
import { quizLessonFormSchema } from "../validators/quizLessonFormSchema";

import MatchingQuestion from "./MatchingQuestion";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";
import type { UseFormReturn } from "react-hook-form";

const pair = (id: string, optionText: string, matchedWord: string, displayOrder: number) => ({
  id,
  sortableId: id,
  optionText,
  matchedWord,
  isCorrect: true,
  displayOrder,
});

let formApi: UseFormReturn<QuizLessonFormValues> | undefined;

const QuestionWithEmptyPrompt = () => {
  const form = useForm<QuizLessonFormValues>({
    resolver: zodResolver(quizLessonFormSchema(i18next.t)),
    defaultValues: {
      title: "Animals",
      questions: [
        {
          id: "question-1",
          sortableId: "question-1",
          type: QuestionType.MATCHING,
          title: "Match the animal with its sound",
          displayOrder: 1,
          options: [pair("pair-1", "", "Meow", 1), pair("pair-2", "Dog", "Woof", 2)],
        },
      ],
    },
  });

  useEffect(() => {
    formApi = form;
  }, [form]);

  return (
    <Form {...form}>
      <MatchingQuestion form={form} questionIndex={0} />
    </Form>
  );
};

describe("matching question editor validation", () => {
  it("leaves validation to the form schema and shows the error next to the pair", async () => {
    renderWith().render(<QuestionWithEmptyPrompt />);

    expect(
      screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingPromptInput(0, 0)),
    ).not.toBeRequired();
    expect(
      screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, 0)),
    ).not.toBeRequired();

    await act(async () => {
      await formApi?.trigger();
    });

    expect(
      await screen.findByText(
        i18next.t("adminCourseView.curriculum.lesson.validation.optionTextRequired"),
      ),
    ).toBeInTheDocument();
  });
});
