import { screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { Form } from "~/components/ui/form";
import { renderWith } from "~/utils/testUtils";

import { QUIZ_LESSON_FORM_HANDLES } from "../../../../../../../../e2e/data/curriculum/handles";
import { makeQuizLessonFormValues } from "../testFactories";

import QuizFeedbackSection from "./QuizFeedbackSection";

import type { QuizLessonFormValues } from "../validators/quizLessonFormSchema";

const FeedbackSection = ({
  isStructureLocked,
  readOnly,
}: {
  isStructureLocked: boolean;
  readOnly: boolean;
}) => {
  const form = useForm<QuizLessonFormValues>({
    defaultValues: makeQuizLessonFormValues({
      feedbackRanges: [{ id: "band-1", minPercent: 0, maxPercent: 100, message: "Well done" }],
    }),
  });

  return (
    <Form {...form}>
      <QuizFeedbackSection form={form} isStructureLocked={isStructureLocked} readOnly={readOnly} />
    </Form>
  );
};

const messageEditor = () => document.querySelector("#feedbackRangeMessage-0 [contenteditable]");

describe("QuizFeedbackSection", () => {
  it("lets translators edit messages while band structure stays locked", async () => {
    renderWith().render(<FeedbackSection isStructureLocked readOnly={false} />);

    expect(screen.getByTestId(QUIZ_LESSON_FORM_HANDLES.feedbackRangeMinInput(0))).toBeDisabled();
    expect(screen.queryByTestId(QUIZ_LESSON_FORM_HANDLES.FEEDBACK_ADD_RANGE_BUTTON)).toBeNull();
    await screen.findByText("Well done");
    expect(messageEditor()).toHaveAttribute("contenteditable", "true");
  });

  it("locks messages in read-only mode", async () => {
    renderWith().render(<FeedbackSection isStructureLocked readOnly />);

    await screen.findByText("Well done");
    expect(messageEditor()).toHaveAttribute("contenteditable", "false");
  });
});
