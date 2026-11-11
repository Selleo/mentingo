import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { renderWith } from "~/utils/testUtils";

import { MFAGuard } from "./MFAGuard";

let currentUser: { shouldVerifyMFA: boolean; requiresPasswordChange: boolean } | null = null;

vi.mock("~/api/queries/useAuthSession", async () => {
  const { AUTH_SESSION_STATUS } = await import("@repo/shared");
  return {
    useAuthSession: () => ({
      data: currentUser && { status: AUTH_SESSION_STATUS.AUTHENTICATED },
      isLoading: false,
      isError: false,
    }),
  };
});
vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: currentUser, isLoading: false }),
}));

function LessonDestination() {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}${location.hash}`}</div>;
}

const renderAuth = (entry: string) =>
  renderWith().render(
    <MemoryRouter
      initialEntries={[entry]}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route
          path="/auth/:page"
          element={
            <MFAGuard mode="auth">
              <div>Registration</div>
            </MFAGuard>
          }
        />
        <Route path="/course/:courseId/lesson/:lessonId" element={<LessonDestination />} />
        <Route path="/course/:slug" element={<div>Course page</div>} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("course registration return", () => {
  beforeEach(() => {
    currentUser = null;
    useNavigationHistoryStore.getState().clearHistory();
  });

  it("keeps the course destination while registration is in progress", async () => {
    renderAuth("/auth/register?returnTo=%2Fcourse%2Fintro%3Flanguage%3Dpl");

    await waitFor(() => {
      expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(
        "/course/intro?language=pl",
      );
    });
  });

  it("returns to the course after authentication", async () => {
    currentUser = { shouldVerifyMFA: false, requiresPasswordChange: false };
    renderAuth("/auth/register?returnTo=%2Fcourse%2Fintro");

    expect(await screen.findByText("Course page")).toBeInTheDocument();
  });

  it("retains the exact lesson destination through anonymous authentication", async () => {
    const path = "/course/course-1/lesson/lesson-1?language=pl&preview=true#section-2";
    renderAuth(`/auth/login?returnTo=${encodeURIComponent(path)}`);
    await waitFor(() => {
      expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(path);
    });
  });

  it("returns to the exact lesson destination after authentication", async () => {
    const path = "/course/course-1/lesson/lesson-1?language=pl&preview=true#section-2";
    currentUser = { shouldVerifyMFA: false, requiresPasswordChange: false };
    renderAuth(`/auth/login?returnTo=${encodeURIComponent(path)}`);
    expect(await screen.findByText(path)).toBeInTheDocument();
  });

  it("ignores an unsafe return destination", async () => {
    currentUser = { shouldVerifyMFA: false, requiresPasswordChange: false };
    renderAuth("/auth/register?returnTo=%2F%2Fevil.example");

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});
