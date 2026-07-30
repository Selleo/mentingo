import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseOverviewTabs, { COURSE_OVERVIEW_TABS } from "./CourseOverviewTabs";

describe("CourseOverviewTabs", () => {
  it("shows the chat tab to learners and selects it", async () => {
    const user = userEvent.setup();
    const onTabChange = vi.fn();

    renderWith().render(
      <CourseOverviewTabs
        activeTab={COURSE_OVERVIEW_TABS.TOC}
        canEditContent={false}
        canShowChat
        canShowStatistics={false}
        hasMissingTranslations={false}
        onEditContent={vi.fn()}
        onTabChange={onTabChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Statistics" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit content" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Discussion" }));

    expect(onTabChange).toHaveBeenCalledWith(COURSE_OVERVIEW_TABS.CHAT);
  });

  it("shows the missing translation tooltip next to the edit action", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <CourseOverviewTabs
        activeTab={COURSE_OVERVIEW_TABS.TOC}
        canEditContent
        canShowChat={false}
        canShowStatistics={false}
        hasMissingTranslations
        onEditContent={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    const warning = screen.getByRole("button", { name: "Missing translations" });
    const editContent = screen.getByRole("button", { name: "Edit content" });

    expect(warning.compareDocumentPosition(editContent)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await user.hover(warning);

    expect(
      await screen.findAllByText(
        "Some course content is missing a translation in the selected language.",
      ),
    ).not.toHaveLength(0);
  });

  it("hides the warning when curriculum translations are complete", () => {
    renderWith().render(
      <CourseOverviewTabs
        activeTab={COURSE_OVERVIEW_TABS.TOC}
        canEditContent
        canShowChat={false}
        canShowStatistics={false}
        hasMissingTranslations={false}
        onEditContent={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Missing translations" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit content" })).toBeInTheDocument();
  });
});
