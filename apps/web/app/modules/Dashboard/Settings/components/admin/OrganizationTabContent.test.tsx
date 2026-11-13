import { screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import type { GlobalSettings } from "../../types";

vi.mock("~/api/queries/useStripeConfigured", () => ({
  useStripeConfigured: () => ({ data: { enabled: false } }),
}));
vi.mock("./LoginMethods", () => ({ default: () => <div>Login methods</div> }));
vi.mock("./ConfigurationStatus", () => ({ ConfigurationStatus: () => null }));
vi.mock("./InviteOnlyRegistration", () => ({
  InviteOnlyRegistration: () => <div>Invite-only registration</div>,
}));
vi.mock("./LiveTrainingMaxParallelSessionsSetting", () => ({
  LiveTrainingMaxParallelSessionsSetting: () => null,
}));
vi.mock("./RoleBasedMFAEnforcementSwitch", () => ({ default: () => null }));
vi.mock("./DefaultCourseCurrencySelect", () => ({ DefaultCourseCurrencySelect: () => null }));
vi.mock("./AgeLimitSelect", () => ({ AgeLimitSelect: () => null }));
vi.mock("./UploadFilesToLoginPage", () => ({ UploadFilesToLoginPage: () => null }));

afterEach(() => vi.unstubAllEnvs());

it.each([true, false])(
  "does not render redundant SSO enforcement with environment management permission %s",
  async (canManageEnvs) => {
    vi.stubEnv("VITE_GOOGLE_OAUTH_ENABLED", "true");
    vi.stubEnv("VITE_MICROSOFT_OAUTH_ENABLED", "true");
    vi.resetModules();
    const { default: Content } = await import("./OrganizationTabContent");
    const { renderWith } = await import("~/utils/testUtils");
    renderWith({ withQuery: true }).render(
      <Content
        globalSettings={{ enforceSSO: true } as GlobalSettings}
        canManageEnvs={canManageEnvs}
      />,
    );

    expect(
      screen.queryByTestId(SETTINGS_PAGE_HANDLES.SSO_ENFORCEMENT_CARD),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Invite-only registration")).toBeInTheDocument();
    expect(screen.queryByText("Login methods") !== null).toBe(canManageEnvs);
  },
);
