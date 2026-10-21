import { useLocation } from "@remix-run/react";
import { createRemixStub } from "@remix-run/testing";
import { LOGIN_METHODS } from "@repo/shared";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { vi, it, expect, beforeEach } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

import LoginMethods from "./LoginMethods";

const loginMethodSetup = vi.hoisted(() => ({
  methods: { google: false, microsoft: false, slack: false, magicLink: true, password: true },
  missingCredentials: {
    google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    microsoft: ["MICROSOFT_CLIENT_SECRET"],
    slack: [],
  },
}));
const envApi = vi.hoisted(() => ({
  envControllerGetLoginMethodSetup: vi.fn(),
  envControllerUpdateLoginMethod: vi.fn(),
}));

vi.mock("~/api/api-client", () => ({ ApiClient: { api: envApi } }));

const EnvsPageLocation = () => {
  const { pathname, hash } = useLocation();

  return <p>{`${pathname}${hash}`}</p>;
};

const renderLoginMethods = async () => {
  const RemixStub = createRemixStub([
    { path: "/", Component: LoginMethods },
    { path: "/admin/envs", Component: EnvsPageLocation },
  ]);
  renderWith({ withQuery: true }).render(<RemixStub />);

  const magicLinkSwitch = await screen.findByRole("switch", { name: "Magic link" });
  await waitFor(() => expect(magicLinkSwitch).toBeEnabled());
};

beforeEach(() => {
  envApi.envControllerGetLoginMethodSetup.mockReset();
  envApi.envControllerGetLoginMethodSetup.mockResolvedValue({ data: { data: loginMethodSetup } });
  envApi.envControllerUpdateLoginMethod.mockReset();
  envApi.envControllerUpdateLoginMethod.mockResolvedValue({ data: { data: loginMethodSetup } });
});

it("blocks enabling a provider with missing credentials and links to its env section", async () => {
  await renderLoginMethods();

  expect(screen.getByRole("switch", { name: /Microsoft/ })).toBeDisabled();
  await userEvent.click(
    screen.getByTestId(SETTINGS_PAGE_HANDLES.loginMethodEnvsLink(LOGIN_METHODS.MICROSOFT)),
  );

  expect(await screen.findByText("/admin/envs#microsoftSignIn")).toBeInTheDocument();
  expect(envApi.envControllerUpdateLoginMethod).not.toHaveBeenCalled();
});

it("keeps an enabled provider with missing credentials switchable off", async () => {
  envApi.envControllerGetLoginMethodSetup.mockResolvedValue({
    data: {
      data: { ...loginMethodSetup, methods: { ...loginMethodSetup.methods, google: true } },
    },
  });
  await renderLoginMethods();

  const googleSwitch = screen.getByRole("switch", { name: /Google/ });
  expect(googleSwitch).toBeEnabled();
  await userEvent.click(googleSwitch);

  await waitFor(() =>
    expect(envApi.envControllerUpdateLoginMethod).toHaveBeenCalledWith({
      method: LOGIN_METHODS.GOOGLE,
      enabled: false,
    }),
  );
});

it("toggles a configured login method in place", async () => {
  await renderLoginMethods();

  await userEvent.click(screen.getByRole("switch", { name: /Slack/ }));
  await userEvent.click(screen.getByRole("switch", { name: "Magic link" }));

  await waitFor(() => {
    expect(envApi.envControllerUpdateLoginMethod).toHaveBeenCalledWith({
      method: LOGIN_METHODS.SLACK,
      enabled: true,
    });
    expect(envApi.envControllerUpdateLoginMethod).toHaveBeenCalledWith({
      method: LOGIN_METHODS.MAGIC_LINK,
      enabled: false,
    });
  });
});

it("offers the configuration shortcut only for providers with missing credentials", async () => {
  await renderLoginMethods();

  expect(screen.getAllByRole("link", { name: /Go to configuration/ })).toHaveLength(2);
});

it("explains on the blocked switch that the env variables are required", async () => {
  await renderLoginMethods();

  await userEvent.hover(screen.getByRole("switch", { name: /Microsoft/ }).parentElement!);

  expect(
    await screen.findAllByText(
      "Add all required environment variables to enable this login method.",
    ),
  ).not.toHaveLength(0);
});
