import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CalendarOutlookEventDetailsDialog } from "./CalendarOutlookEventDetailsDialog";

import type { OutlookCalendarEventDetails } from "../calendarEventDetails.types";

const eventDetails = (
  overrides: Partial<OutlookCalendarEventDetails> = {},
): OutlookCalendarEventDetails => ({
  id: "f08b7dc0-5048-4e97-a491-c9a321033aad",
  uid: "microsoft-outlook:event",
  sourceType: "microsoft_outlook",
  sourceId: "8d6fc5ec-e170-45d5-b40a-185882489864",
  title: "Outlook planning",
  description: null,
  startsAt: "2026-07-22T09:00:00.000Z",
  endsAt: "2026-07-22T10:00:00.000Z",
  allDay: false,
  timezone: "UTC",
  location: "Board room",
  status: "scheduled",
  payload: {
    outlookCalendar: {
      webLink: "https://outlook.office.com/calendar/item/1",
      isSensitive: false,
      availability: "busy",
    },
  },
  ...overrides,
});

describe("CalendarOutlookEventDetailsDialog", () => {
  it("shows the safe Outlook action and imported metadata", () => {
    renderWith().render(
      <CalendarOutlookEventDetailsDialog
        open
        eventDetails={eventDetails()}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Outlook planning")).toBeInTheDocument();
    expect(screen.getByText("Board room")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "https://outlook.office.com/calendar/item/1",
    );
  });

  it("does not offer external navigation for masked private events", () => {
    renderWith().render(
      <CalendarOutlookEventDetailsDialog
        open
        eventDetails={eventDetails({
          title: "Private event",
          location: null,
          payload: {
            outlookCalendar: {
              webLink: null,
              isSensitive: true,
              availability: "tentative",
            },
          },
        })}
        onOpenChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(
      screen.getByText("Details are hidden for this private Outlook event."),
    ).toBeInTheDocument();
  });
});
