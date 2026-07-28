import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import DeadlineModal from "./DeadlineModal";

describe("DeadlineModal", () => {
  it("closes with Escape", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWith().render(
      <DeadlineModal
        deadlineEnabledDraft
        groupDeadlines={[
          { id: "group-1", name: "Sales", deadline: "2026-08-01", isMandatory: true },
        ]}
        isSaving={false}
        onChangeGroupDeadlines={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
        onToggleDeadline={vi.fn()}
      />,
    );

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("uses the project switch and passes its next value", async () => {
    const user = userEvent.setup();
    const onToggleDeadline = vi.fn();

    renderWith().render(
      <DeadlineModal
        deadlineEnabledDraft
        groupDeadlines={[
          { id: "group-1", name: "Sales", deadline: "2026-08-01", isMandatory: true },
        ]}
        isSaving={false}
        onChangeGroupDeadlines={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleDeadline={onToggleDeadline}
      />,
    );

    await user.click(screen.getByRole("switch"));

    expect(onToggleDeadline).toHaveBeenCalledWith(false);
  });

  it("disables the switch when there are no assigned groups", () => {
    renderWith().render(
      <DeadlineModal
        deadlineEnabledDraft={false}
        groupDeadlines={[]}
        isSaving={false}
        onChangeGroupDeadlines={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onToggleDeadline={vi.fn()}
      />,
    );

    expect(screen.getByRole("switch")).toBeDisabled();
  });
});
