import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  canManageCategories: true,
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

const renderEditor = (props = defaultProps) =>
  renderWith().render(
    <MemoryRouter>
      <CourseCategoryEditor {...props} />
    </MemoryRouter>,
  );

describe("CourseCategoryEditor", () => {
  it("displays the localized and fallback category titles returned by the API", () => {
    renderEditor();

    expect(
      screen.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption("Mathematics")),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(COURSE_SETTINGS_HANDLES.categoryOption("Matematyka")),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage categories" })).toHaveAttribute(
      "href",
      "/admin/categories",
    );
  });

  it("hides category management link without category management permission", () => {
    renderEditor({ ...defaultProps, canManageCategories: false });

    expect(screen.queryByRole("link", { name: "Manage categories" })).not.toBeInTheDocument();
  });

  it("styles the missing-category placeholder like the missing course title", () => {
    renderEditor({
      ...defaultProps,
      categoryId: "missing-category",
      categoryTitle: "Select category",
      isEditing: false,
    });

    const editButton = screen.getByRole("button", { name: "Select category" });

    expect(editButton).toHaveClass("text-neutral-200");
    expect(editButton.querySelector("svg")).toBeInTheDocument();
  });
});
