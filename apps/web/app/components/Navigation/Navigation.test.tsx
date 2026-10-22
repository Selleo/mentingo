import { PERMISSIONS } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompetenciesConfiguration } from "~/api/queries/useCompetenciesConfiguration";
import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";
import { matchesRequirement } from "~/common/permissions/permission.utils";

import { Navigation } from "./Navigation";

import type { PermissionKey } from "~/common/permissions/permission.utils";
import type { LeafMenuItem } from "~/config/navigationConfig";

const state = vi.hoisted(() => ({ permissions: [] as PermissionKey[] }));

vi.mock("@remix-run/react", () => ({ useLocation: () => ({ pathname: "/dashboard" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/queries", () => ({ useCurrentUser: () => ({ data: { id: "user" } }) }));
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
vi.mock("./NavigationHeader", () => ({ NavigationHeader: () => null }));
vi.mock("./NavigationFooter", () => ({ NavigationFooter: () => null }));
vi.mock("./NavigationGlobalSearchWrapper", () => ({ NavigationGlobalSearchWrapper: () => null }));
vi.mock("./NavigationMenu", () => ({
  NavigationMenu: ({
    menuItems,
    permissions,
  }: {
    menuItems: LeafMenuItem[];
    permissions: PermissionKey[];
  }) => (
    <>
      {menuItems
        .filter((item) => matchesRequirement(permissions, item.accessRequirement))
        .map((item) => (
          <a key={item.link} href={item.link}>
            {item.label}
          </a>
        ))}
    </>
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
