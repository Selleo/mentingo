import { PERMISSIONS } from "@repo/shared";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Navigation } from "./Navigation";

const state = vi.hoisted(() => ({
  permissions: [] as string[],
  enabled: true,
  totalItems: undefined as number | undefined,
  query: vi.fn(),
}));
vi.mock("@remix-run/react", () => ({ useLocation: () => ({ pathname: "/dashboard" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "student", roleSlugs: [] } }),
}));
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: ({ required = [] }: { required?: string[] }) => ({
    permissions: state.permissions,
    hasAccess: required.some((permission) => state.permissions.includes(permission)),
  }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { learningPathsEnabled: state.enabled } }),
}));
vi.mock("~/api/queries/useLearningPaths", () => ({
  useLearningPaths: (...args: unknown[]) => {
    state.query(...args);
    return {
      data:
        state.totalItems === undefined
          ? undefined
          : { pagination: { totalItems: state.totalItems } },
    };
  },
}));
vi.mock("~/api/queries/admin/useConfigurationState", () => ({ useConfigurationState: () => ({}) }));
vi.mock("~/api/queries/useCompetenciesConfiguration", () => ({
  useCompetenciesConfiguration: () => ({}),
}));
vi.mock("~/api/queries/usePhishingConfiguration", () => ({ usePhishingConfiguration: () => ({}) }));
vi.mock("~/api/queries/useStripeConfigured", () => ({ useStripeConfigured: () => ({}) }));
vi.mock("~/modules/Admin/Admin.layout", () => ({ shouldHideTopbarAndSidebar: () => false }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => "pl",
}));
vi.mock("./NavigationHeader", () => ({ NavigationHeader: () => null }));
vi.mock("./NavigationFooter", () => ({ NavigationFooter: () => null }));
vi.mock("./NavigationGlobalSearchWrapper", () => ({ NavigationGlobalSearchWrapper: () => null }));
vi.mock("./NavigationMenu", () => ({
  NavigationMenu: ({ menuItems }: { menuItems: { label: string; link: string }[] }) => (
    <>
      {menuItems.map((item) => (
        <a key={item.link} href={item.link}>
          {item.label}
        </a>
      ))}
    </>
  ),
}));

const pathLink = () => screen.queryByRole("link", { name: "navigationSideBar.learningPaths" });

afterEach(cleanup);
beforeEach(() => {
  state.permissions = [PERMISSIONS.LEARNING_PATH_READ];
  state.enabled = true;
  state.totalItems = 0;
  state.query.mockClear();
});

describe("learning paths navigation", () => {
  it("hides the learner entry when the accessible list is empty", () => {
    render(<Navigation />);
    expect(pathLink()).not.toBeInTheDocument();
    expect(state.query).toHaveBeenCalledWith(
      { page: 1, perPage: 1, language: "pl" },
      { enabled: true },
    );
  });
  it("does not flash the entry before accessible paths load", () => {
    state.totalItems = undefined;
    render(<Navigation />);
    expect(pathLink()).not.toBeInTheDocument();
  });
  it("shows the learner entry when at least one path is accessible", () => {
    state.totalItems = 1;
    render(<Navigation />);
    expect(pathLink()).toHaveAttribute("href", "/development-paths");
  });
  it("updates the entry when access to the last path is removed", () => {
    state.totalItems = 1;
    const { rerender } = render(<Navigation />);
    expect(pathLink()).toBeInTheDocument();
    state.totalItems = 0;
    rerender(<Navigation />);
    expect(pathLink()).not.toBeInTheDocument();
  });
  it("keeps the administrator entry when no paths exist", () => {
    state.permissions.push(PERMISSIONS.LEARNING_PATH_CREATE);
    render(<Navigation />);
    expect(pathLink()).toBeInTheDocument();
    expect(state.query).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });
  it("hides the entry when the tenant disables paths", () => {
    state.enabled = false;
    state.totalItems = 1;
    render(<Navigation />);
    expect(pathLink()).not.toBeInTheDocument();
    expect(state.query).toHaveBeenCalledWith(expect.anything(), { enabled: false });
  });
});
