import { useLocation } from "@remix-run/react";
import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import RegisterPage from "./Register.page";

const state = vi.hoisted(() => ({
  loginMethods: undefined as { password: boolean; slack: boolean; magicLink: boolean } | undefined,
}));

vi.mock("~/api/mutations/useRegisterUser", () => ({
  useRegisterUser: () => ({ mutate: vi.fn() }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: null }),
  useGlobalSettingsSuspense: () => ({
    data: { enforceSSO: false, inviteOnlyRegistration: false, loginBackgroundImageS3Key: null },
  }),
}));

vi.mock("~/api/queries/useRegistrationForm", () => ({
  useRegistrationForm: () => ({ data: null }),
}));

vi.mock("~/api/queries/useLoginMethods", () => ({
  useLoginMethods: () => ({ data: state.loginMethods }),
}));

vi.mock("~/components/PlatformLogo", () => ({ PlatformLogo: () => null }));

const renderRegisterPage = () => {
  const RemixStub = createRemixStub([
    { path: "/auth/register", Component: RegisterPage },
    {
      path: "/auth/login",
      Component: () => {
        const location = useLocation();
        return (
          <h1>
            Login destination: {location.pathname}
            {location.search}
          </h1>
        );
      },
    },
  ]);

  return renderWith({ withQuery: true }).render(
    <RemixStub initialEntries={["/auth/register?returnTo=%2Fcourses%2Fcourse-1"]} />,
  );
};

describe("password registration availability", () => {
  it("redirects direct entries to login when password is disabled even if Slack and magic links are enabled", async () => {
    await i18next.changeLanguage("en");
    state.loginMethods = { password: false, slack: true, magicLink: true };
    renderRegisterPage();

    expect(
      await screen.findByRole("heading", {
        name: "Login destination: /auth/login?returnTo=%2Fcourses%2Fcourse-1",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create an account" })).not.toBeInTheDocument();
  });

  it("does not expose the password form before login methods are available", async () => {
    await i18next.changeLanguage("en");
    state.loginMethods = undefined;
    renderRegisterPage();

    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create an account" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        name: "Login destination: /auth/login?returnTo=%2Fcourses%2Fcourse-1",
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps password registration available when enabled", async () => {
    await i18next.changeLanguage("en");
    state.loginMethods = { password: true, slack: false, magicLink: false };
    renderRegisterPage();

    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create an account" })).toBeInTheDocument();
  });
});
