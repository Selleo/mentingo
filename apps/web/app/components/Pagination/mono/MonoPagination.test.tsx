import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { MonoPagination } from "./MonoPagination";

describe("MonoPagination", () => {
  it("renders the rows per page control, item range and page buttons", () => {
    renderWith().render(<MonoPagination totalItems={234} currentPage={1} onPageChange={vi.fn()} />);

    expect(screen.getByText("Rows per page:")).toBeInTheDocument();
    expect(screen.getByText("1-10 of 234 items")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "24" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
  });

  it("changes page with the page, previous and next buttons", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    renderWith().render(
      <MonoPagination totalItems={234} currentPage={5} onPageChange={onPageChange} />,
    );

    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "24" }));

    expect(onPageChange.mock.calls).toEqual([[6], [4], [24]]);
  });

  it("hides the rows per page control when it cannot be changed", () => {
    renderWith().render(
      <MonoPagination totalItems={20} canChangeItemsPerPage={false} onPageChange={vi.fn()} />,
    );

    expect(screen.queryByText("Rows per page:")).not.toBeInTheDocument();
  });

  it("renders the empty state without items", () => {
    renderWith().render(<MonoPagination totalItems={0} onPageChange={vi.fn()} />);

    expect(screen.getByText("No data found")).toBeInTheDocument();
  });
});
