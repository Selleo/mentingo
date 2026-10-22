import { matchesRequirement, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { matchesRequirement } from "~/common/permissions/permission.utils";

import { Navigation } from "./Navigation";
import { useNavigationStore } from "./stores/navigationStore";

import type { PermissionKey } from "~/common/permissions/permission.utils";
import type { LeafMenuItem } from "~/config/navigationConfig";

const state = vi.hoisted(() => ({ permissions: [] as PermissionKey[], roleSlugs: [] as string[] }));

vi.mock("@remix-run/react", () => ({ useLocation: () => ({ pathname: "/dashboard" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/queries", () => ({
  useCurrentUser: () => ({ data: { id: "user", roleSlugs: state.roleSlugs } }),
}));
vi.mock("~/api/queries/admin/useConfigurationState", () => ({
  useConfigurationState: () => ({}),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({ useGlobalSettings: () => ({}) }));
vi.mock("~/api/queries/useLearningPaths", () => ({ useLearningPaths: () => ({}) }));
vi.mock("~/api/queries/useStripeConfigured", () => ({ useStripeConfigured: () => ({}) }));
vi.mock("~/api/queries/usePhishingConfiguration", () => ({ usePhishingConfiguration: vi.fn() }));
vi.mock("~/api/queries/useCompetenciesConfiguration", () => ({
  useCompetenciesConfiguration: vi.fn(),
}));
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAccess: false, permissions: state.permissions }),
}));
vi.mock("~/modules/Admin/Admin.layout", () => ({ shouldHideTopbarAndSidebar: () => false }));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: () => "en",
}));
vi.mock("~/components/Icon", () => ({ Icon: () => null }));
vi.mock("./NavigationHeader", () => ({
  // Mirrors the real header: it renders its own search below the 2xl breakpoint.
  NavigationHeader: ({ is2xlBreakpoint }: { is2xlBreakpoint: boolean }) =>
    is2xlBreakpoint ? null : <div data-testid="global-search" />,
}));
vi.mock("./NavigationFooter", () => ({ NavigationFooter: () => null }));
vi.mock("./NavigationGlobalSearchWrapper", () => ({
  NavigationGlobalSearchWrapper: () => <div data-testid="global-search" />,
}));
vi.mock("./NavigationMenu", () => ({
  NavigationMenu: ({
    menuItems,
    permissions,
    isExpandable,
    expandableLabel,
    showNavigationLabels,
    isSidebarCollapsed,
  }: {
    menuItems: LeafMenuItem[];
    permissions: PermissionKey[];
    isExpandable?: boolean;
    expandableLabel?: string;
    showNavigationLabels: boolean;
    isSidebarCollapsed: boolean;
  }) => (
    <section
      data-testid={`navigation-menu-${expandableLabel}`}
      data-expandable={Boolean(isExpandable)}
      data-labels={showNavigationLabels}
      data-collapsed={isSidebarCollapsed}
    >
      {isExpandable && <span>{expandableLabel}</span>}
      {menuItems
        .filter((item) => matchesRequirement(permissions, item.accessRequirement))
        .map((item) => (
          <a key={item.link} href={item.link}>
            {item.label}
          </a>
        ))}
    </section>
  ),
}));

beforeEach(() => {
  vi.mocked(useCompetenciesConfiguration).mockReturnValue({
    data: { enabled: false },
    isError: false,
  } as ReturnType<typeof useCompetenciesConfiguration>);
});

describe("Phishing navigation availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.permissions = [PERMISSIONS.PHISHING_MANAGE];
    state.roleSlugs = [];
  });

  it.each([
    [
      "missing connection settings or disabled capability",
      { data: { enabled: false }, isError: false },
    ],
    ["configuration still loading", { data: undefined, isError: false }],
    [
      "configuration request failed with previously enabled data",
      { data: { enabled: true }, isError: true },
    ],
  ])("hides phishing when %s", (_name, configuration) => {
    vi.mocked(usePhishingConfiguration).mockReturnValue(
      configuration as ReturnType<typeof usePhishingConfiguration>,
    );

    render(<Navigation />);

    expect(screen.queryByRole("link", { name: "phishing.title" })).not.toBeInTheDocument();
  });

  it.each([PERMISSIONS.PHISHING_MANAGE, PERMISSIONS.PHISHING_REPORT_READ])(
    "shows enabled phishing for users with %s",
    (permission) => {
      state.permissions = [permission];
      vi.mocked(usePhishingConfiguration).mockReturnValue({
        data: { enabled: true },
        isError: false,
      } as ReturnType<typeof usePhishingConfiguration>);

      render(<Navigation />);

      expect(screen.getByRole("link", { name: "phishing.title" })).toHaveAttribute(
        "href",
        "/phishing",
      );
      expect(usePhishingConfiguration).toHaveBeenCalledWith(true);
    },
  );

  it("does not request configuration or show phishing without permission", () => {
    state.permissions = [];
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: true },
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);

    render(<Navigation />);

    expect(usePhishingConfiguration).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("link", { name: "phishing.title" })).not.toBeInTheDocument();
  });
});

describe("role-specific Assistant navigation presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: false },
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);
  });

  const personas = [
    {
      name: "student",
      roles: [SYSTEM_ROLE_SLUGS.STUDENT],
      permissions: [PERMISSIONS.COURSE_READ],
      grouped: false,
      conversations: false,
    },
    {
      name: "content creator",
      roles: [SYSTEM_ROLE_SLUGS.CONTENT_CREATOR],
      permissions: [PERMISSIONS.COURSE_CREATE],
      grouped: false,
      conversations: false,
    },
    {
      name: "admin",
      roles: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: [PERMISSIONS.AI_THREAD_READ],
      grouped: true,
      conversations: true,
    },
    {
      name: "admin without conversation oversight",
      roles: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: [],
      grouped: true,
      conversations: false,
    },
    {
      name: "custom authorized reviewer",
      roles: ["custom-reviewer"],
      permissions: [PERMISSIONS.AI_THREAD_READ],
      grouped: false,
      conversations: true,
    },
    {
      name: "multi-role admin and student",
      roles: [SYSTEM_ROLE_SLUGS.ADMIN, SYSTEM_ROLE_SLUGS.STUDENT],
      permissions: [PERMISSIONS.AI_THREAD_READ],
      grouped: true,
      conversations: true,
    },
  ];
  const viewports = [
    { mode: "mobile", width: 390, collapsed: false, labels: true },
    { mode: "desktop", width: 1600, collapsed: false, labels: true },
    { mode: "collapsed desktop", width: 1600, collapsed: true, labels: false },
  ];

  it.each(
    personas.flatMap((persona) => viewports.map((viewport) => ({ ...persona, ...viewport }))),
  )(
    "preserves native $mode navigation for $name",
    ({ roles, permissions, grouped, conversations, width, collapsed, labels }) => {
      state.roleSlugs = roles;
      state.permissions = permissions;
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        writable: true,
        value: width,
      });
      useNavigationStore.setState({ isSidebarCollapsed: collapsed });
      render(<Navigation />);
      expect(screen.getByRole("link", { name: "navigationSideBar.aiAssistant" })).toHaveAttribute(
        "href",
        "/assistant",
      );
      const group = screen.queryByTestId("navigation-menu-navigationSideBar.ai");
      if (grouped) {
        expect(group).toHaveAttribute("data-expandable", "true");
        expect(group).toHaveAttribute("data-labels", String(labels));
        expect(group).toHaveAttribute("data-collapsed", String(collapsed));
      } else {
        expect(group).not.toBeInTheDocument();
        const standalone = screen.getByTestId("navigation-menu-navigationSideBar.aiAssistant");
        expect(standalone).toHaveAttribute("data-expandable", "false");
        expect(standalone).toHaveAttribute("data-labels", String(labels));
        expect(standalone).toHaveAttribute("data-collapsed", String(collapsed));
      }
      const history = screen.queryByRole("link", { name: "aiConversations.title" });
      if (conversations) expect(history).toHaveAttribute("href", "/admin/ai-conversations");
      else expect(history).not.toBeInTheDocument();
    },
  );
});

describe("global search mounting", () => {
  it("mounts a single search below the 2xl breakpoint so ⌘K opens one dialog", () => {
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: false },
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);

    render(<Navigation />);

    expect(screen.getAllByTestId("global-search")).toHaveLength(1);
  });
});

describe("Competencies navigation availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.permissions = [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.PHISHING_MANAGE];
    vi.mocked(usePhishingConfiguration).mockReturnValue({
      data: { enabled: true },
      isError: false,
    } as ReturnType<typeof usePhishingConfiguration>);
  });
  it.each([
    { data: { enabled: false }, isError: false },
    { data: undefined, isError: false },
    { data: { enabled: true }, isError: true },
  ])("hides unavailable competencies independently of enabled phishing", (configuration) => {
    vi.mocked(useCompetenciesConfiguration).mockReturnValue(
      configuration as ReturnType<typeof useCompetenciesConfiguration>,
    );
    render(<Navigation />);
    expect(screen.queryByRole("link", { name: "competencies.title" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "phishing.title" })).toBeInTheDocument();
  });
  it("requires its own permission even if the capability was previously enabled", () => {
    state.permissions = [PERMISSIONS.PHISHING_MANAGE];
    vi.mocked(useCompetenciesConfiguration).mockReturnValue({
      data: { enabled: true },
      isError: false,
    } as ReturnType<typeof useCompetenciesConfiguration>);
    render(<Navigation />);
    expect(useCompetenciesConfiguration).toHaveBeenCalledWith(false);
    expect(screen.queryByRole("link", { name: "competencies.title" })).not.toBeInTheDocument();
  });
  it("shows competencies with its permission and enabled capability", () => {
    vi.mocked(useCompetenciesConfiguration).mockReturnValue({
      data: { enabled: true },
      isError: false,
    } as ReturnType<typeof useCompetenciesConfiguration>);
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "competencies.title" })).toHaveAttribute(
      "href",
      "/competencies",
    );
  });
});
