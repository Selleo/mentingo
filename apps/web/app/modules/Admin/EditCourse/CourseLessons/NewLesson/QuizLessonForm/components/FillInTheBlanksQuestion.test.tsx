import { screen, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { Form } from "~/components/ui/form";
import { renderWith } from "~/utils/testUtils";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { QuestionType } from "../QuizLessonForm.types";

import FillInTheBlanksQuestion from "./FillInTheBlanksQuestion";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";

const ReadOnlyQuestion = () => {
  const form = useForm<QuizLessonFormValues>({
    defaultValues: {
      title: "Safeguards",
      questions: [
        {
          id: "question-1",
          sortableId: "question-1",
          type: QuestionType.FILL_IN_THE_BLANKS_DND,
          title: "Match the safeguard",
          displayOrder: 1,
          description:
            '<p>Protect <button type="button" class="bg-primary-100 text-primary-500" data-word="customer" data-option-id="option-1"><span>customer</span></button> data.</p>',
          options: [
            {
              id: "option-1",
              sortableId: "option-1",
              optionText: "customer",
              isCorrect: true,
              displayOrder: 1,
            },
          ],
        },
      ],
    },
  });

  return (
    <Form {...form}>
      <FillInTheBlanksQuestion
        form={form}
        questionIndex={0}
        questionType={QuestionType.FILL_IN_THE_BLANKS_DND}
        readOnly
      />
    </Form>
  );
};

describe("read-only fill-in-the-blanks question", () => {
  it("shows answer placements and words without edit controls", async () => {
    renderWith().render(<ReadOnlyQuestion />);

    const editor = await screen.findByTestId(QUIZ_LESSON_FORM_HANDLES.fillBlanksEditor(0));
    const placement = editor.querySelector('[data-option-id="option-1"]');
    expect(placement).toHaveTextContent("customer");
    expect(placement?.tagName).toBe("SPAN");
    expect(placement?.querySelectorAll("span")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /drag word/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete question/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId(QUIZ_LESSON_FORM_HANDLES.addWordButton(0))).not.toBeInTheDocument();
    const words = screen.getByText("customer", { selector: "span.py-1" });
    const chip = words.parentElement?.parentElement;
    expect(chip).toHaveClass("pl-3", "pr-3", "border-primary-500", "bg-success-100");
    expect(words).toHaveClass("text-primary-500");
    expect(within(chip as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });
});
