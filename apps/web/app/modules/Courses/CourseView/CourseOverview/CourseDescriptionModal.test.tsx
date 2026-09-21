import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseDescriptionModal from "./CourseDescriptionModal";

vi.mock("../../context/CourseAccessProvider", () => ({
  useCourseAccessProvider: () => ({
    course: {
      category: "Analytics",
      description: "Course description",
      estimatedDurationSeconds: 3_600,
      chapters: [],
      learningOutcomes: [],
      title: "Statistics",
    },
    isAdminExperience: false,
  }),
}));

describe("CourseDescriptionModal", () => {
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
