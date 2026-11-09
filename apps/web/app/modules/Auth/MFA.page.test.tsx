import { createRemixStub } from "@remix-run/testing";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMfaChallenge } from "~/api/mutations/useMfaChallenge";
import { useAuthSession } from "~/api/queries/useAuthSession";
import { LOGIN_REDIRECT_URL, MFA_URL } from "~/modules/Auth/constants";

import MFAPage from "./MFA.page";

import type { AuthSessionStatus } from "@repo/shared";

vi.mock("~/api/queries/useAuthSession");
vi.mock("~/api/mutations/useMfaChallenge");
vi.mock("./components", () => ({
  SetupMFACard: () => <div>Set up MFA</div>,
  VerifyMFACard: () => <div>Verify MFA</div>,
}));

const startChallenge = vi.fn();

function renderMfaPage(status: AuthSessionStatus, setupRequired = false) {
  vi.mocked(useAuthSession).mockReturnValue({
    data: { status, setupRequired },
    isLoading: false,
  } as ReturnType<typeof useAuthSession>);
  vi.mocked(useMfaChallenge).mockReturnValue({
    mutate: startChallenge,
    isSuccess: true,
    isError: false,
  } as unknown as ReturnType<typeof useMfaChallenge>);

  const App = createRemixStub([
    { path: MFA_URL, Component: MFAPage },
    { path: LOGIN_REDIRECT_URL, Component: () => <div>Dashboard</div> },
  ]);
  render(<App initialEntries={[MFA_URL]} />);
}

describe("MFA page", () => {
  beforeEach(() => startChallenge.mockClear());

  it("starts a challenge and shows setup while MFA is still required", async () => {
    renderMfaPage(AUTH_SESSION_STATUS.MFA_REQUIRED, true);

    expect(await screen.findByText("Set up MFA")).toBeVisible();
    expect(startChallenge).toHaveBeenCalled();
  });

  it("leaves a verified session untouched when the page remounts after setup", async () => {
    renderMfaPage(AUTH_SESSION_STATUS.AUTHENTICATED);

    expect(await screen.findByText("Dashboard")).toBeVisible();
    expect(startChallenge).not.toHaveBeenCalled();
  });
});
