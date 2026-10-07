import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { CourseGenerationDrawer } from "./CourseGenerationDrawer";

import type { ListAuthoringSessionsResponse } from "~/api/generated-api";

const COURSE_ID = "00000000-0000-4000-8000-000000000001";
const TOTAL_SESSIONS = 12;

const allSessions = Array.from({ length: TOTAL_SESSIONS }, (_, index) => ({
  sessionId: `00000000-0000-4000-8000-00000000${String(index + 1).padStart(4, "0")}`,
  courseId: COURSE_ID,
  language: "en" as const,
  status: "active" as const,
  title: `Chat ${index + 1}`,
  createdAt: "2026-09-22T08:00:00.000Z",
  lastActivityAt: "2026-09-22T09:00:00.000Z",
}));

vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: {} }),
}));

vi.mock("./CourseGenerationSession", () => ({
  CourseGenerationSession: () => null,
}));

vi.mock("./courseAuthoring.api", () => ({
  listAuthoringSessions: vi.fn(
    async (
      _courseId: string,
      params?: { page?: number; perPage?: number; keyword?: string },
    ): Promise<ListAuthoringSessionsResponse> => {
      const page = params?.page ?? 1;
      const perPage = params?.perPage ?? 20;
      const filtered = params?.keyword
        ? allSessions.filter((session) =>
            session.title.toLowerCase().includes(params.keyword!.toLowerCase()),
          )
        : allSessions;
      const start = (page - 1) * perPage;
      return {
        data: filtered.slice(start, start + perPage),
        pagination: { totalItems: filtered.length, page, perPage },
      };
    },
  ),
}));

describe("CourseGenerationDrawer session menu", () => {
  it("keeps the popover open and appends more sessions when Load more is clicked", async () => {
    const user = userEvent.setup();
    renderWith()
      .withQuery()
      .withI18n()
      .render(
        <CourseGenerationDrawer
          courseId={COURSE_ID}
          language="en"
          open
          onOpenChange={() => {}}
        />,
      );

    const trigger = await screen.findByTestId("course-authoring-session-menu-trigger");
    await user.click(trigger);

    const list = await screen.findByTestId("course-authoring-session-menu-list");
    await waitFor(() => expect(within(list).getByText("Chat 1")).toBeInTheDocument());

    const loadMoreButton = await screen.findByRole("button", { name: /load more/i });
    await user.click(loadMoreButton);

    await waitFor(() => expect(within(list).getByText(`Chat ${TOTAL_SESSIONS}`)).toBeInTheDocument());

    expect(screen.getByTestId("course-authoring-session-menu-search")).toBeInTheDocument();
    expect(screen.getByTestId("course-authoring-session-menu-list")).toBeInTheDocument();
  });
});
