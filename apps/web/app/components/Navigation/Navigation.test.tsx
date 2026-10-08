import { PERMISSIONS } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePhishingConfiguration } from "~/api/queries/usePhishingConfiguration";

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
  NavigationMenu: ({ menuItems }: { menuItems: LeafMenuItem[] }) => (
    <>
      {menuItems.map((item) => (
        <a key={item.link} href={item.link}>
          {item.label}
        </a>
      ))}
    </>
  ),
}));

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
