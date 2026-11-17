import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ReportFilterBuilder } from "./ReportFilterBuilder";

import type { ReportFilterField, ReportFilterTree } from "./reports.types";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("report filter option search", () => {
  it.each(["learner", "groupId", "courseId", "pathId"] as const)(
    "keeps the %s dropdown and search focus while options are loading",
    async (field: ReportFilterField) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onOptionSearch = vi.fn();
      const value: ReportFilterTree = {
        join: "and",
        conditions: [{ id: "condition", field, operator: "eq" }],
        groups: [],
      };
      const props = { value, onChange, onOptionSearch };
      const { rerender } = render(
        <ReportFilterBuilder
          {...props}
          options={{ [field]: [{ id: "participant", label: "Participant" }] }}
        />,
      );
      await user.click(screen.getByRole("combobox", { name: "reports.filters.value" }));
      const search = screen.getByPlaceholderText("common.optionPicker.search");
      await user.type(search, "anna");

      // A new uncached search has no data until its API response arrives.
      rerender(<ReportFilterBuilder {...props} options={{}} />);
      expect(screen.getByPlaceholderText("common.optionPicker.search")).toBe(search);
      expect(search).toHaveFocus();
      expect(search).toHaveValue("anna");
      await user.type(search, "@example.com");
      expect(search).toHaveValue("anna@example.com");

      rerender(
        <ReportFilterBuilder
          {...props}
          options={{ [field]: [{ id: "anna", label: "anna@example.com" }] }}
        />,
      );
      expect(search).toHaveFocus();
      await user.click(screen.getByRole("option", { name: "anna@example.com" }));
      expect(onChange).toHaveBeenLastCalledWith({
        ...value,
        conditions: [{ ...value.conditions[0], value: "anna" }],
      });
    },
  );
});
