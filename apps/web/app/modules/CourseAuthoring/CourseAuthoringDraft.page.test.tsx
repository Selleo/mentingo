import { fireEvent, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import CourseAuthoringDraftPage from "./CourseAuthoringDraft.page";

const { mockOpen, mockConfigured, mockSnapshot, mockCanEdit } = vi.hoisted(() => ({
  mockOpen: vi.fn(),
  mockConfigured: vi.fn(),
  mockSnapshot: vi.fn(),
  mockCanEdit: vi.fn(),
}));

vi.mock("~/api/queries", () => ({
  useCurrentUserSuspense: () => ({ data: { id: "actor" } }),
}));

vi.mock("./courseAuthoring.api", () => ({
  openAuthoringDraft: mockOpen,
}));

vi.mock("~/api/queries/useLumaConfigured", () => ({
  useLumaConfigured: mockConfigured,
}));

vi.mock("~/api/queries/useCourseAuthoringSessionQuery", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/api/queries/useCourseAuthoringSessionQuery")>()),
  useCourseAuthoringSessionQuery: mockSnapshot,
}));

vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: mockCanEdit,
}));

vi.mock("./CourseGenerationSession", () => ({
  CourseGenerationSession: ({ sessionId }: { sessionId: string }) => <p>{sessionId}</p>,
}));

const LocationLabel = () => <output aria-label="Destination">{useLocation().search}</output>;

const renderDraft = (search = "") =>
  renderWith({ withQuery: true }).render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/admin/beta-courses/new/standard/ai${search}`]}>
        <Routes>
          <Route
            path="/admin/beta-courses/new/standard/ai"
            element={<CourseAuthoringDraftPage />}
          />
          <Route path="/admin/beta-courses/new/standard" element={<p>Standard course form</p>} />
          <Route path="/admin/beta-courses/:id/authoring" element={<LocationLabel />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>,
  );

describe("AI course draft route", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();
    mockConfigured.mockReturnValue({ data: { courseGenerationEnabled: true } });
    mockSnapshot.mockReturnValue({
      data: { courseId: "draft-a", status: "active", language: "en" },
    });
    mockCanEdit.mockReturnValue({ hasAccess: true });
  });

  it("opens one draft during effect replay and resumes the saved workspace", async () => {
    mockOpen.mockResolvedValue({ courseId: "draft-a", sessionId: "session-a" });

    renderDraft();

    expect(await screen.findByText("session-a")).toBeInTheDocument();
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockSnapshot).toHaveBeenCalledWith("draft-a", "session-a");
  });

  it("offers a retry and reuses the same creation command after an interrupted request", async () => {
    mockOpen
      .mockRejectedValueOnce(new Error("Request timed out"))
      .mockResolvedValueOnce({ courseId: "draft-a", sessionId: "session-a" });

    renderDraft();

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("session-a")).toBeInTheDocument();
    expect(mockOpen).toHaveBeenCalledTimes(2);
    expect(mockOpen.mock.calls[1]).toEqual(mockOpen.mock.calls[0]);
  });

  it("hands off the same session in its selected course language from a saved draft link", async () => {
    mockSnapshot.mockReturnValue({
      data: { courseId: "course-a", status: "active", language: "pl" },
    });

    renderDraft("?draftId=draft-a&sessionId=session-a");

    expect(await screen.findByLabelText("Destination")).toHaveTextContent(
      "?sessionId=session-a&language=pl",
    );
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("shows completion to authors without course editing permission", () => {
    mockSnapshot.mockReturnValue({
      data: { courseId: "course-a", status: "active", language: "en" },
    });
    mockCanEdit.mockReturnValue({ hasAccess: false });

    renderDraft("?draftId=draft-a&sessionId=session-a");

    expect(screen.getByRole("heading", { name: "Course created" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Destination")).not.toBeInTheDocument();
  });

  it.each([
    { data: { courseId: "draft-a", status: "discarded", language: "en" } },
    { error: { isAxiosError: true, response: { status: 410 } } },
  ])("offers a fresh draft when the saved one has expired", (snapshot) => {
    mockSnapshot.mockReturnValue(snapshot);

    renderDraft("?from=courses&draftId=draft-a&sessionId=session-a");

    expect(screen.getByRole("heading", { name: "This draft has expired" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start a new draft" })).toHaveAttribute(
      "href",
      "/admin/beta-courses/new/standard/ai?from=courses",
    );
    expect(mockOpen).not.toHaveBeenCalled();
  });

  it("returns to the Standard course form when course generation is disabled", async () => {
    mockConfigured.mockReturnValue({ data: { courseGenerationEnabled: false } });

    renderDraft();

    await waitFor(() => expect(screen.getByText("Standard course form")).toBeInTheDocument());
    expect(mockSnapshot).not.toHaveBeenCalled();
    expect(mockOpen).not.toHaveBeenCalled();
  });
});
