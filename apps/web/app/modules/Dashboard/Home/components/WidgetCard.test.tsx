import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { Info } from "lucide-react";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { DashboardWidgetDataScope } from "../types";

import { DashboardWidgetHeader } from "./WidgetCard";

describe("DashboardWidgetHeader", () => {
  it("identifies the widget data scope with an icon tooltip", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <DashboardWidgetHeader
        title="Course completion"
        icon={Info}
        dataScope={DashboardWidgetDataScope.PERSONAL}
      />,
    );

    const scopeButton = screen.getByRole("button", { name: "Your data" });

    await user.hover(scopeButton);

    const tooltipContent = document.querySelector('[data-state="instant-open"]');

    expect(tooltipContent).toBeVisible();
    expect(
      within(tooltipContent as HTMLElement).getAllByText(
        "This widget shows your personal learning data.",
      )[0],
    ).toBeVisible();
  });

  it("exposes additional widget context through an accessible tooltip", async () => {
    const user = userEvent.setup();

    renderWith().render(
      <DashboardWidgetHeader
        title="AI Mentor practice"
        icon={Info}
        info="You can generate one new AI Practice Session per day."
      />,
    );

    const infoButton = screen.getByRole("button", {
      name: "You can generate one new AI Practice Session per day.",
    });

    await user.hover(infoButton);

    const tooltipContent = document.querySelector('[data-state="instant-open"]');

    expect(tooltipContent).toBeVisible();
    expect(
      within(tooltipContent as HTMLElement).getAllByText(
        "You can generate one new AI Practice Session per day.",
      )[0],
    ).toBeVisible();
  });
});
