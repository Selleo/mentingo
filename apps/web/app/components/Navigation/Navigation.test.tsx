import { matchesRequirement, PERMISSIONS, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";

import { Navigation } from "./Navigation";
import { useNavigationStore } from "./stores/navigationStore";

import type { Dispatch, RefObject, SetStateAction } from "react";
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
vi.mock("~/api/queries/usePhishingConfiguration", () => ({
  usePhishingConfiguration: vi.fn(() => ({ data: { enabled: false }, isError: false })),
}));
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
  // Mirrors the real header: it renders its own search and the menu toggle below the 2xl breakpoint.
  NavigationHeader: ({
    is2xlBreakpoint,
    setIsMobileNavOpen,
    menuToggleRef,
  }: {
    is2xlBreakpoint: boolean;
    setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
    menuToggleRef: RefObject<HTMLButtonElement>;
  }) =>
    is2xlBreakpoint ? null : (
      <>
        <div data-testid="global-search" />
        <button ref={menuToggleRef} onClick={() => setIsMobileNavOpen((isOpen) => !isOpen)}>
          navigationSideBar.menu
        </button>
      </>
    ),
}));
vi.mock("./NavigationFooter", () => ({ NavigationFooter: () => null }));
vi.mock("./NavigationGlobalSearchWrapper", () => ({
  NavigationGlobalSearchWrapper: () => <div data-testid="global-search" />,
}));
vi.mock("./NavigationMenu", () => ({
  NavigationMenu: ({
    menuItems,
    permissions,
    setIsMobileNavOpen,
    isExpandable,
    expandableLabel,
    showNavigationLabels,
    isSidebarCollapsed,
  }: {
    menuItems: LeafMenuItem[];
    permissions: PermissionKey[];
    setIsMobileNavOpen: Dispatch<SetStateAction<boolean>>;
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
          <a
            key={item.link}
            href={item.link}
            onClick={(event) => {
              event.preventDefault();
              setIsMobileNavOpen(false);
            }}
          >
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

describe("sidebar collapse toggle", () => {
  beforeEach(() => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1440);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("names the toggle after the action it performs", async () => {
    useNavigationStore.setState({ isSidebarCollapsed: false });

    render(<Navigation />);

    const toggle = await screen.findByRole("button", {
      name: "navigationSideBar.ariaLabels.collapseSidebar",
    });

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "navigationSideBar.ariaLabels.expandSidebar" }),
    ).toBeInTheDocument();
  });

  it("exposes the sidebar state with aria-expanded and keeps the nav focusable", async () => {
    useNavigationStore.setState({ isSidebarCollapsed: true });

    render(<Navigation />);

    const toggle = await screen.findByRole("button", {
      name: "navigationSideBar.ariaLabels.expandSidebar",
    });

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("navigation")).not.toHaveAttribute("inert");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("offers to expand a collapsed sidebar and to collapse it again after expanding", async () => {
    useNavigationStore.setState({ isSidebarCollapsed: true });

    render(<Navigation />);

    const toggle = await screen.findByRole("button", {
      name: "navigationSideBar.ariaLabels.expandSidebar",
    });

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", { name: "navigationSideBar.ariaLabels.collapseSidebar" }),
    ).toBeInTheDocument();
  });
});

describe("mobile menu below the 2xl breakpoint", () => {
  beforeEach(() => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(1366);
    state.permissions = [];
    state.roleSlugs = [SYSTEM_ROLE_SLUGS.STUDENT];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the closed menu out of the focus order and opens it for keyboard users", () => {
    render(<Navigation />);

    const nav = screen.getByRole("navigation", { hidden: true });

    expect(nav).toHaveAttribute("inert");

    fireEvent.click(screen.getByRole("button", { name: "navigationSideBar.menu" }));

    expect(nav).not.toHaveAttribute("inert");
  });

  it("returns focus to the menu button when choosing an item closes the menu", () => {
    render(<Navigation />);
    const menuButton = screen.getByRole("button", { name: "navigationSideBar.menu" });

    fireEvent.click(menuButton);
    const item = screen.getAllByRole("link")[0];

    item.focus();
    fireEvent.click(item);

    expect(screen.getByRole("navigation", { hidden: true })).toHaveAttribute("inert");
    expect(menuButton).toHaveFocus();
  });
});
