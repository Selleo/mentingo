import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringReasoningControl } from "./AuthoringReasoningControl";

describe("AuthoringReasoningControl", () => {
  it("shows the current level in the chip and describes it in the popover", async () => {
    const user = userEvent.setup();
    renderWith().render(<AuthoringReasoningControl value="medium" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Thinking effort: Balanced" }));

    const slider = screen.getByRole("slider", { name: "Thinking effort" });
    expect(slider).toHaveAttribute("aria-valuetext", "Balanced, 2 of 3");
    expect(
      screen.getByText("Balances speed and depth for most course changes."),
    ).toBeInTheDocument();
  });

  it("changes level from the slider and from the stop labels", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWith().render(<AuthoringReasoningControl value="medium" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Thinking effort: Balanced" }));
    fireEvent.change(screen.getByRole("slider", { name: "Thinking effort" }), {
      target: { value: "2" },
    });
    expect(onChange).toHaveBeenLastCalledWith("high");

    await user.click(screen.getByRole("button", { name: "Fast" }));
    expect(onChange).toHaveBeenLastCalledWith("low");
  });

  it("cannot be opened while disabled", () => {
    renderWith().render(<AuthoringReasoningControl value="low" onChange={vi.fn()} disabled />);

    expect(screen.getByRole("button", { name: "Thinking effort: Fast" })).toBeDisabled();
  });
});
