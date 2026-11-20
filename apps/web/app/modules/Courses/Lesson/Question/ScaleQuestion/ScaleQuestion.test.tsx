import { fireEvent, render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import { makeQuizQuestion, makeQuizQuestionOption } from "../testFactories";

import { ScaleQuestion } from "./ScaleQuestion";

import type { PropsWithChildren } from "react";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/modules/Courses/context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({ isPreviewMode: false }),
}));

const FormWrapper = ({ children }: PropsWithChildren) => {
  const form = useForm();

  return <FormProvider {...form}>{children}</FormProvider>;
};

describe("ScaleQuestion", () => {
  it("names the slider after the question and announces the selected option", () => {
    render(
      <ScaleQuestion
        question={makeQuizQuestion({
          type: "scale_1_5",
          title: "How confident are you?",
          options: ["Not at all", "Slightly", "Somewhat", "Very", "Fully"].map(
            (optionText, index) =>
              makeQuizQuestionOption({
                id: `option-${index}`,
                optionText,
                displayOrder: index + 1,
              }),
          ),
        })}
      />,
      { wrapper: FormWrapper },
    );

    const slider = screen.getByRole("slider", { name: "How confident are you?" });

    expect(slider).toHaveAttribute("aria-valuetext", "Not at all");

    fireEvent.change(slider, { target: { value: "2" } });

    expect(slider).toHaveAttribute("aria-valuetext", "Somewhat");
  });
});
