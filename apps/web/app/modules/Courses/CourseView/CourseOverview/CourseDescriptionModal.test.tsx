import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseDescriptionModal from "./CourseDescriptionModal";

vi.mock("~/components/RichText/Viever", () => ({
  default: ({ content }: { content: string }) => (
    <output data-testid="course-description-html">{content}</output>
  ),
}));

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      category: "Analytics",
      description: '<p>Course description</p><iframe src="https://attacker.example"></iframe>',
      estimatedDurationSeconds: 3_600,
      chapters: [],
      learningOutcomes: [],
      title: "Statistics",
    },
    isAdminExperience: false,
  }),
}));

describe("CourseDescriptionModal", () => {
  it("sanitizes the read-only course description before passing it to the viewer", () => {
    renderWith().render(
      <CourseDescriptionModal
        canEdit={false}
        courseDescription=""
        onChangeDescription={vi.fn()}
        onClose={vi.fn()}
        onSaveDescription={vi.fn()}
      />,
    );

    expect(screen.getByTestId("course-description-html")).toHaveTextContent(
      "<p>Course description</p>",
    );
    expect(screen.getByTestId("course-description-html").textContent).not.toContain("iframe");
  });

  it("has dialog semantics and closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <CourseDescriptionModal
        canEdit
        courseDescription="Course description"
        onChangeDescription={vi.fn()}
        onClose={onClose}
        onSaveDescription={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog")).toHaveClass("flex", "max-h-[90dvh]", "sm:!max-w-4xl");

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });
});
