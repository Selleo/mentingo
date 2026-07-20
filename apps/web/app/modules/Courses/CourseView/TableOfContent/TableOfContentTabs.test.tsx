import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import TableOfContentTabs, { TABLE_OF_CONTENT_TABS } from "./TableOfContentTabs";

describe("TableOfContentTabs", () => {
  it("shows the chat tab to learners and selects it", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderWith().render(
      <TableOfContentTabs
        activeTab={TABLE_OF_CONTENT_TABS.TOC}
        canEditContent={false}
        canShowChat
        canShowStatistics={false}
        onEditContent={vi.fn()}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit content" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discussion" }));

    expect(onTabChange).toHaveBeenCalledWith(TABLE_OF_CONTENT_TABS.CHAT);
  });
});
