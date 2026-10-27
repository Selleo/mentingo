import { PERMISSIONS } from "@repo/shared";
import { fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import NavigationWrapper from "./NavigationWrapper";

import type { ReactElement } from "react";

const state = vi.hoisted(() => ({
  user: { id: "actor", permissions: [] as string[] } as {
    id: string;
    permissions: string[];
  } | null,
  mounts: 0,
  renderedPaths: [] as string[],
}));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: state.user }) }));
vi.mock("~/api/queries/useCurrentUserSessionSuspense", () => ({
  useCurrentUserSessionSuspense: () => ({ data: state.user }),
}));
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
function PageContent() {
  const { pathname } = useLocation();
  state.renderedPaths.push(pathname);
  return <div>Page content: {pathname}</div>;
}
function renderLayout(path = "/courses") {
  return renderWith().render(
    <MemoryRouter initialEntries={[path]}>
      <NavigationLinks />
      <Routes>
        <Route element={<NavigationWrapper />}>
          <Route path="*" element={<PageContent />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  state.user = { id: "actor", permissions: Object.values(PERMISSIONS) };
  state.mounts = 0;
  state.renderedPaths = [];
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
  it("retains staging's route guard before mounting a protected page", () => {
    state.user = { id: "actor", permissions: [] };
    renderLayout("/admin/users");
    expect(state.renderedPaths).not.toContain("/admin/users");
    expect(screen.queryByText("Page content: /admin/users")).not.toBeInTheDocument();
    expect(screen.getByText("Page content: /")).toBeVisible();
  });
  it("does not mount a dock for anonymous visitors", () => {
    state.user = null;
    renderLayout();
    expect(screen.queryByTestId("persistent-dock")).not.toBeInTheDocument();
    expect(screen.getByText("Page content: /courses")).toBeVisible();
  });
});
