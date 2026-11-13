import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import RegisterPage from "./Register.page";

vi.mock("~/components/PlatformLogo", () => ({ PlatformLogo: () => <div /> }));

vi.mock("~/api/mutations/useRegisterUser", () => ({
  useRegisterUser: () => ({ mutate: vi.fn() }),
}));

const settings = vi.hoisted(() => ({ enforceSSO: true, inviteOnlyRegistration: true }));
const loginMethods = vi.hoisted(() => ({ password: true, magicLink: true, google: false }));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: null }),
  useGlobalSettingsSuspense: () => ({
    data: {
      ...settings,
      loginBackgroundImageS3Key: null,
    },
  }),
}));

vi.mock("~/api/queries/useRegistrationForm", () => ({
  useRegistrationForm: () => ({ data: null }),
}));

vi.mock("~/api/queries/useLoginMethods", () => ({
  useLoginMethods: () => ({ data: loginMethods }),
}));

describe("Register page with invite-only registration", () => {
  beforeEach(() => {
    settings.enforceSSO = true;
    settings.inviteOnlyRegistration = true;
    loginMethods.password = true;
  });

  it("shows password registration despite persisted legacy SSO enforcement", async () => {
    settings.inviteOnlyRegistration = false;
    await i18next.changeLanguage("en");
    const Stub = createRemixStub([{ path: "/auth/register", Component: RegisterPage }]);
    renderWith().render(<Stub initialEntries={["/auth/register"]} />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it.each([false, true])(
    "hides disabled password registration with legacy SSO=%s",
    async (enforceSSO) => {
      settings.enforceSSO = enforceSSO;
      settings.inviteOnlyRegistration = false;
      loginMethods.password = false;
      await i18next.changeLanguage("en");
      const Stub = createRemixStub([{ path: "/auth/register", Component: RegisterPage }]);
      renderWith().render(<Stub initialEntries={["/auth/register"]} />);
      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    },
  );
  it("explains the restriction and links to login without showing the form", async () => {
    await i18next.changeLanguage("en");
    const RemixStub = createRemixStub([{ path: "/auth/register", Component: RegisterPage }]);

    renderWith().render(<RemixStub initialEntries={["/auth/register"]} />);

    expect(
      screen.getByRole("heading", { name: "Registration is only possible by invitation." }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/auth/login");
    expect(screen.queryByRole("button", { name: "Create an account" })).not.toBeInTheDocument();
  });

  it("preserves the course return URL in the login link", async () => {
    await i18next.changeLanguage("en");
    const RemixStub = createRemixStub([{ path: "/auth/register", Component: RegisterPage }]);

    renderWith().render(
      <RemixStub initialEntries={["/auth/register?returnTo=%2Fcourses%2Fcourse-1"]} />,
    );

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/auth/login?returnTo=%2Fcourses%2Fcourse-1",
    );
  });
});
