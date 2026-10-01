import { screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { renderWith } from "~/utils/testUtils";

import { MFAGuard } from "./MFAGuard";

let currentUser: { shouldVerifyMFA: boolean; requiresPasswordChange: boolean } | null = null;

vi.mock("~/api/queries/useCurrentUser", () => ({
  useCurrentUser: () => ({ data: currentUser, isLoading: false }),
}));

const renderAuth = (entry: string) =>
  renderWith().render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/auth/register"
          element={
            <MFAGuard mode="auth">
              <div>Registration</div>
            </MFAGuard>
          }
        />
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

  it("ignores an unsafe return destination", async () => {
    currentUser = { shouldVerifyMFA: false, requiresPasswordChange: false };
    renderAuth("/auth/register?returnTo=%2F%2Fevil.example");

    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
  });
});
