import { zodResolver } from "@hookform/resolvers/zod";
import { act, fireEvent, screen } from "@testing-library/react";
import i18next from "i18next";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { Form } from "~/components/ui/form";
import { renderWith } from "~/utils/testUtils";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { QuestionType } from "../QuizLessonForm.types";
import { quizLessonFormSchema } from "../validators/quizLessonFormSchema";

import MatchingQuestion from "./MatchingQuestion";
import QuestionWrapper from "./QuestionWrapper";

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

const QuestionWithEmptyFields = ({
  title = "",
  options = [pair("pair-1", "", "Meow", 1), pair("pair-2", "Dog", "Woof", 2)],
}: {
  title?: string;
  options?: ReturnType<typeof pair>[];
}) => {
  const form = useForm<QuizLessonFormValues>({
    resolver: zodResolver(quizLessonFormSchema(i18next.t)),
    defaultValues: {
      title: "Animals",
      questions: [
        {
          id: "question-1",
          sortableId: "question-1",
          type: QuestionType.MATCHING,
          title,
          displayOrder: 1,
          options,
        },
      ],
    },
  });

  useEffect(() => {
    formApi = form;
  }, [form]);

  return (
    <Form {...form}>
      <QuestionWrapper
        questionType={QuestionType.MATCHING}
        questionIndex={0}
        form={form}
        dragTrigger={null}
        item={form.watch("questions.0")}
        isOpen
        handleToggle={() => {}}
      >
        <MatchingQuestion form={form} questionIndex={0} />
      </QuestionWrapper>
    </Form>
  );
};

describe("matching question editor validation", () => {
  it("leaves validation to the form schema and shows its errors next to the fields", async () => {
    renderWith().render(<QuestionWithEmptyFields />);

    expect(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.questionTitleInput(0))).not.toBeRequired();
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
    expect(
      screen.getByText(i18next.t("adminCourseView.curriculum.lesson.validation.titleMinLength")),
    ).toBeInTheDocument();
  });

  it("points at each untranslated pair instead of asking for more pairs", async () => {
    renderWith().render(
      <QuestionWithEmptyFields
        title="Dopasuj zwierzę do dźwięku"
        options={[
          pair("pair-1", "Kot", "Miau", 1),
          pair("pair-2", "Pies", "Hau", 2),
          pair("pair-3", "", "", 3),
          pair("pair-4", "", "", 4),
        ]}
      />,
    );

    await act(async () => {
      await formApi?.trigger();
    });

    const validationMessage = (key: string) =>
      i18next.t(`adminCourseView.curriculum.lesson.validation.${key}`);

    expect(
      await screen.findAllByText(
        `${validationMessage("optionTextRequired")} ${validationMessage("matchingMatchRequired")}`,
      ),
    ).toHaveLength(2);
    expect(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, 2))).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, 0))).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.queryByText(validationMessage("matchingPairsRequired"))).not.toBeInTheDocument();
    expect(screen.queryByText(validationMessage("matchingPairsUnique"))).not.toBeInTheDocument();
  });

  it("keeps every pair error visible when matches repeat and clears one once it is fixed", async () => {
    renderWith().render(
      <QuestionWithEmptyFields
        title="Animals"
        options={[
          pair("pair-1", "Cat", "Meow", 1),
          pair("pair-2", "Kitten", "Meow", 2),
          pair("pair-3", " ", "", 3),
        ]}
      />,
    );

    await act(async () => {
      await formApi?.trigger();
    });

    const validationMessage = (key: string) =>
      i18next.t(`adminCourseView.curriculum.lesson.validation.${key}`);

    expect(await screen.findAllByText(validationMessage("matchingPairsUnique"))).toHaveLength(2);
    expect(
      screen.getByText(
        `${validationMessage("optionTextRequired")} ${validationMessage("matchingMatchRequired")}`,
      ),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, 1)), {
      target: { value: "Mew" },
    });

    await vi.waitFor(() =>
      expect(screen.queryByText(validationMessage("matchingPairsUnique"))).not.toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        `${validationMessage("optionTextRequired")} ${validationMessage("matchingMatchRequired")}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.matchingMatchInput(0, 1))).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });
});
