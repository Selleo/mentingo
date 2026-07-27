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
    const editButton = screen.getByRole("button", { name: "Enter course title..." });

    expect(editButton).toBeInTheDocument();
    expect(editButton).toHaveClass("inline-block", "max-w-full");
    expect(editButton).not.toHaveClass("w-full");
    expect(editButton.querySelector("svg")).toHaveClass("-top-0.5", "ml-3", "align-middle");
    expect(placeholder).toHaveClass("text-neutral-200");
  });

  it("hides the edit pencil and uses the localized placeholder in edit mode", () => {
    const { container } = render(<CourseTitleEditor {...defaultProps} isEditing />);

    expect(screen.getByPlaceholderText("Enter course title...")).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeInTheDocument();
  });

  it("keeps the same title box model while entering edit mode", () => {
    const { rerender } = render(
      <CourseTitleEditor {...defaultProps} title="Course title" isEditing={false} />,
    );

    const button = screen.getByRole("button", { name: "Course title" });
    const titleContainerClassName = button.parentElement?.className;

    expect(button).toHaveClass("inline-block", "border-2", "p-2");

    rerender(<CourseTitleEditor {...defaultProps} title="Course title" isEditing />);

    const textarea = screen.getByDisplayValue("Course title");
    const sizeMirror = textarea.previousElementSibling;

    expect(textarea.parentElement?.parentElement?.tagName).toBe("H1");
    expect(textarea.parentElement?.parentElement?.className).toBe(titleContainerClassName);
    expect(textarea).toHaveClass("block", "border-2", "p-2");
    expect(sizeMirror).toHaveClass("invisible", "border-2", "p-2");
    expect(sizeMirror).toHaveTextContent("Course title");
  });
});
