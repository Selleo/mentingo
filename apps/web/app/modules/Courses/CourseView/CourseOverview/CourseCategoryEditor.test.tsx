import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSE_SETTINGS_HANDLES } from "../../../../../e2e/data/courses/handles";

import CourseCategoryEditor from "./CourseCategoryEditor";

import type { ComponentProps } from "react";

const categories: ComponentProps<typeof CourseCategoryEditor>["categories"] = [
  {
    id: "english-category",
    title: "Mathematics",
  },
  {
    id: "polish-category",
    title: "Matematyka",
  },
];

const defaultProps: ComponentProps<typeof CourseCategoryEditor> = {
  canEdit: true,
  categories,
  categoryId: "polish-category",
  categoryTitle: "Matematyka",
  disabled: false,
  durationSeconds: 3600,
  isEditing: true,
  onChange: vi.fn().mockResolvedValue(undefined),
  onClose: vi.fn(),
  onEdit: vi.fn(),
};

describe("CourseCategoryEditor", () => {
  it("displays the localized and fallback category titles returned by the API", () => {
    renderWith().render(<CourseCategoryEditor {...defaultProps} />);

    expect(
      screen.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption("Mathematics")),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption("Matematyka")),
    ).toBeInTheDocument();
  });

  it("styles the missing-category placeholder like the missing course title", () => {
    renderWith().render(
      <CourseCategoryEditor
        {...defaultProps}
        categoryId="missing-category"
        categoryTitle="Select category"
        isEditing={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Select category" })).toHaveClass("text-neutral-200");
  });
});
