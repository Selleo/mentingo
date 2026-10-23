import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import NavigationWrapper from "./NavigationWrapper";

import type { ReactElement } from "react";

const state = vi.hoisted(() => ({ user: { id: "actor" } as { id: string } | null, mounts: 0 }));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: state.user }) }));
vi.mock("~/components/Navigation/Navigation", () => ({ Navigation: () => <nav>Navigation</nav> }));
vi.mock("~/modules/SupportMode/SupportModeBanner", () => ({ SupportModeBanner: () => null }));
vi.mock("~/Guards/MFAGuard", () => ({
  MFAGuard: ({ children }: { children: ReactElement }) => children,
}));
vi.mock("~/modules/Assistant/AssistantDock", () => ({
  AssistantDock: () => {
    const [mount] = useState(() => ++state.mounts);
    return <aside data-testid="persistent-dock">Dock {mount}</aside>;
  },
}));
function NavigationLinks() {
  const navigate = useNavigate();
  return (
    <>
      {["/courses", "/settings", "/admin/users", "/course/course/lesson/lesson", "/assistant"].map(
        (path) => (
          <button key={path} onClick={() => navigate(path)}>
            {path}
          </button>
        ),
      )}
    </>
  );
}
function renderLayout() {
  return renderWith().render(
    <MemoryRouter initialEntries={["/courses"]}>
      <NavigationLinks />
      <Routes>
        <Route element={<NavigationWrapper />}>
          <Route path="*" element={<div>Page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.user = { id: "actor" };
  state.mounts = 0;
});
describe("Assistant shared application host", () => {
  it("keeps a single dock mounted across content, user, admin and lesson pages", () => {
    renderLayout();
    const dock = screen.getByTestId("persistent-dock");
    for (const path of [
      "/settings",
      "/admin/users",
      "/course/course/lesson/lesson",
      "/assistant",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: path }));
      expect(screen.getByTestId("persistent-dock")).toBe(dock);
      expect(screen.getAllByTestId("persistent-dock")).toHaveLength(1);
    }
    expect(state.mounts).toBe(1);
  });
  it("does not mount a dock for anonymous visitors", () => {
    state.user = null;
    renderLayout();
    expect(screen.queryByTestId("persistent-dock")).not.toBeInTheDocument();
    expect(screen.getByText("Page content")).toBeVisible();
  });
});
