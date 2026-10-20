import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../../../e2e/data/courses/handles";

import { AddCategoryRow } from "./AddCategoryRow";

type CreateCategoryOptions = { onSuccess: (response: { data: { id: string } }) => void };

const createCategory = vi.fn((_variables: unknown, options: CreateCategoryOptions) =>
  options.onSuccess({ data: { id: "category-1" } }),
);

vi.mock("~/api/mutations/admin/useCreateCategory", () => ({
  useCreateCategory: () => ({ mutate: createCategory, isPending: false }),
}));

describe("AddCategoryRow", () => {
  beforeEach(() => {
    createCategory.mockClear();
  });

  it("creates a category inline and reports it to the parent", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    renderWith().render(<AddCategoryRow onCreated={onCreated} />);

    await user.click(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY));
    const input = screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY_INPUT);
    expect(input).toHaveFocus();

    await user.type(input, "  Leadership  {Enter}");

    expect(createCategory).toHaveBeenCalledTimes(1);
    expect(createCategory).toHaveBeenCalledWith(
      { data: { title: "Leadership", language: expect.any(String) } },
      expect.any(Object),
    );
    expect(onCreated).toHaveBeenCalledWith({ id: "category-1", title: "Leadership" });
    expect(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY)).toBeInTheDocument();
  });

  it("cancels editing on Escape without creating a category", async () => {
    const user = userEvent.setup();

    renderWith().render(<AddCategoryRow onCreated={vi.fn()} />);

    await user.click(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY));
    await user.type(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY_INPUT), "Draft");
    await user.keyboard("{Escape}");

    expect(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY)).toBeInTheDocument();
    expect(createCategory).not.toHaveBeenCalled();
  });

  it("creates the category when the title field loses focus", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    renderWith().render(<AddCategoryRow onCreated={onCreated} />);

    await user.click(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY));
    await user.type(screen.getByTestId(COURSES_INLINE_EDIT_HANDLES.ADD_CATEGORY_INPUT), "Sales");
    await user.click(document.body);

    expect(onCreated).toHaveBeenCalledWith({ id: "category-1", title: "Sales" });
  });
});
