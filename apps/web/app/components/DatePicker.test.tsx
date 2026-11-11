import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { DatePicker } from "./DatePicker";

const dayCell = (day: number) => screen.getByRole("gridcell", { name: String(day) });

describe("DatePicker", () => {
  it("disables days outside the allowed range and returns the picked day", async () => {
    const onChange = vi.fn();

    renderWith().render(
      <DatePicker
        label="Date"
        placeholder="Pick a date"
        value="2026-03-15"
        minDate="2026-03-10"
        maxDate="2026-03-20"
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Date" }));

    expect(dayCell(9)).toBeDisabled();
    expect(dayCell(21)).toBeDisabled();
    expect(dayCell(10)).toBeEnabled();
    expect(dayCell(20)).toBeEnabled();

    await userEvent.click(dayCell(12));

    expect(onChange).toHaveBeenCalledWith("2026-03-12");
  });

  it("keeps every day selectable without a range, as report filters use it", async () => {
    const onChange = vi.fn();

    renderWith().render(
      <DatePicker label="Date" placeholder="Pick a date" value="2026-03-15" onChange={onChange} />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Date" }));

    expect(dayCell(9)).toBeEnabled();
    expect(dayCell(21)).toBeEnabled();

    await userEvent.click(dayCell(21));

    expect(onChange).toHaveBeenCalledWith("2026-03-21");
  });
});
