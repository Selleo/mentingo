import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { WidgetAdminEventCalendar } from "./admin-event-calendar";

import type { GetDashboardEventsResponse } from "~/api/generated-api";

type CalendarEvent = GetDashboardEventsResponse["data"][number];

const { calendarEvents } = vi.hoisted(() => ({
  calendarEvents: [] as CalendarEvent[],
}));

vi.mock("~/api/queries/useDashboardEventCalendar", () => ({
  useDashboardEventCalendar: () => ({ data: calendarEvents }),
}));

const createLiveTrainingEvent = (id: string, title: string, startsAt: string): CalendarEvent => ({
  id,
  sourceType: "live_training",
  targetId: id,
  title,
  startsAt,
  allDay: false,
});

describe("WidgetAdminEventCalendar", () => {
  afterEach(() => {
    calendarEvents.length = 0;
  });

  it("shows selected-day events first, highlights them, and keeps upcoming events below", async () => {
    const user = userEvent.setup();
    const selectedDayStart = new Date();
    selectedDayStart.setHours(12, 0, 0, 0);
    const upcomingStart = new Date(selectedDayStart);
    upcomingStart.setDate(upcomingStart.getDate() + 1);

    calendarEvents.push(
      createLiveTrainingEvent(
        "selected-event",
        "Selected day training",
        selectedDayStart.toISOString(),
      ),
      createLiveTrainingEvent("upcoming-event", "Upcoming training", upcomingStart.toISOString()),
    );

    renderWith({ withQuery: true }).render(
      <MemoryRouter>
        <WidgetAdminEventCalendar />
      </MemoryRouter>,
    );

    const selectedDayHeading = screen.getByRole("heading", { name: "Selected day" });
    const upcomingHeading = screen.getByRole("heading", { name: "Upcoming events" });
    const selectedDaySection = selectedDayHeading.closest("section");
    const upcomingSection = upcomingHeading.closest("section");

    expect(selectedDaySection).not.toBeNull();
    expect(upcomingSection).not.toBeNull();
    expect(selectedDaySection!.compareDocumentPosition(upcomingSection!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const selectedEventButton = within(selectedDaySection!).getByRole("button", {
      name: /Selected day training/,
    });
    expect(selectedEventButton).toHaveClass("bg-primary-50");
    expect(
      within(upcomingSection!).getByRole("button", { name: /Upcoming training/ }),
    ).toBeVisible();
    expect(
      within(upcomingSection!).queryByRole("button", { name: /Selected day training/ }),
    ).toBeNull();
    expect(upcomingSection?.parentElement).toHaveClass(
      "overflow-y-auto",
      "lg:max-h-none",
      "lg:[contain:size]",
    );

    expect(screen.getByRole("button", { name: "Previous month" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Next month" })).toBeVisible();
    const monthSelect = screen.getByRole("combobox", { name: "Select month" });
    const yearSelect = screen.getByRole("combobox", { name: "Select year" });
    expect(monthSelect).toHaveValue(String(selectedDayStart.getMonth()));
    expect(yearSelect).toHaveValue(String(selectedDayStart.getFullYear()));
    expect(within(yearSelect).getAllByRole("option")).toHaveLength(11);
    expect(monthSelect.parentElement?.parentElement?.parentElement).toHaveClass("justify-center");
    await user.selectOptions(yearSelect, String(selectedDayStart.getFullYear() + 1));
    expect(yearSelect).toHaveValue(String(selectedDayStart.getFullYear() + 1));
    await user.selectOptions(yearSelect, String(selectedDayStart.getFullYear()));
    expect(screen.getAllByRole("gridcell")).toHaveLength(42);
    expect(screen.getByRole("article")).toHaveClass("h-full", "sm:max-h-[27rem]");
    expect(screen.getByRole("article")).not.toHaveClass("lg:h-auto");

    const upcomingDayButton = screen.getByRole("gridcell", {
      name: String(upcomingStart.getDate()),
    });
    expect(upcomingDayButton).toHaveClass("bg-primary-50");
    expect(upcomingDayButton).not.toHaveAttribute("aria-selected");

    await user.click(upcomingDayButton);

    expect(upcomingDayButton).toHaveAttribute("aria-selected", "true");
    expect(
      within(selectedDaySection!).getByRole("button", { name: /Upcoming training/ }),
    ).toBeVisible();
  });
});
