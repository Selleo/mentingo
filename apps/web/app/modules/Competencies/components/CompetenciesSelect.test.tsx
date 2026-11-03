import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CompetenciesSelect } from "./CompetenciesSelect";

const options = [
  { value: "welding", label: "Welding" },
  { value: "forklift", label: "Forklift operation" },
];

describe("CompetenciesSelect", () => {
  it("shows the selected label when the value is outside the loaded options", () => {
    renderWith()
      .withI18n()
      .render(
        <CompetenciesSelect
          label="Competency"
          value="first-aid"
          selectedLabel="First aid"
          options={options}
          onChange={vi.fn()}
        />,
      );

    expect(screen.getByRole("combobox", { name: "Competency" })).toHaveTextContent("First aid");
  });

  it("delegates search to the server and keeps every returned option", async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    renderWith()
      .withI18n()
      .render(
        <CompetenciesSelect
          label="Competency"
          value=""
          options={options}
          onChange={vi.fn()}
          onSearchChange={onSearchChange}
        />,
      );

    await user.click(screen.getByRole("combobox", { name: "Competency" }));
    await user.keyboard("weld");

    expect(onSearchChange).toHaveBeenLastCalledWith("weld");
    expect(screen.getByRole("option", { name: "Forklift operation" })).toBeInTheDocument();
  });
});
