import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CourseTitleEditor from "./CourseTitleEditor";

const defaultProps = {
  canEdit: true,
  disabled: false,
  onCancel: vi.fn(),
  onChange: vi.fn(),
  onEdit: vi.fn(),
  onSave: vi.fn(),
  placeholder: "Enter course title...",
  title: "",
};

describe("CourseTitleEditor", () => {
  it("shows the localized placeholder when an editable title is missing", () => {
    render(<CourseTitleEditor {...defaultProps} isEditing={false} />);

    const placeholder = screen.getByText("Enter course title...");

    expect(screen.getByRole("button", { name: "Enter course title..." })).toBeInTheDocument();
    expect(placeholder).toHaveClass("text-neutral-200");
  });

  it("uses the localized placeholder in the title input", () => {
    render(<CourseTitleEditor {...defaultProps} isEditing />);

    expect(screen.getByPlaceholderText("Enter course title...")).toBeInTheDocument();
  });

  it("keeps the same title container and spacing while entering edit mode", () => {
    const { rerender } = render(
      <CourseTitleEditor {...defaultProps} title="Course title" isEditing={false} />,
    );

    const button = screen.getByRole("button", { name: "Course title" });
    const titleContainerClassName = button.parentElement?.className;

    expect(button).toHaveClass("border-2", "p-2");

    rerender(<CourseTitleEditor {...defaultProps} title="Course title" isEditing />);

    const textarea = screen.getByDisplayValue("Course title");

    expect(textarea.parentElement?.tagName).toBe("H1");
    expect(textarea.parentElement?.className).toBe(titleContainerClassName);
    expect(textarea).toHaveClass("border-2", "p-2");
  });
});
