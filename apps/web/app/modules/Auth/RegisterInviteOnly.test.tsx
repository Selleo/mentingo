import { createRemixStub } from "@remix-run/testing";
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import i18next from "~/utils/mocks/i18next.mock";
import { renderWith } from "~/utils/testUtils";

import RegisterPage from "./Register.page";

vi.mock("~/api/mutations/useRegisterUser", () => ({
  useRegisterUser: () => ({ mutate: vi.fn() }),
}));

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: null }),
  useGlobalSettingsSuspense: () => ({
    data: {
      enforceSSO: false,
      inviteOnlyRegistration: true,
      loginBackgroundImageS3Key: null,
    },
  }),
}));

vi.mock("~/api/queries/useRegistrationForm", () => ({
  useRegistrationForm: () => ({ data: null }),
}));

vi.mock("~/api/queries/useSSOEnabled", () => ({
  useSSOEnabled: () => ({ data: null }),
}));

describe("Register page with invite-only registration", () => {
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
