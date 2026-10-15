import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { version } from "~/../version.json";
import { mockedUseNavigate, mockRemixReact } from "~/utils/mocks/remix-run-mock";
import { renderWith } from "~/utils/testUtils";

import LoginPage from "./Login.page";

vi.mock("../../../api/api-client");
vi.mock("~/api/queries/useLoginPageFiles", () => ({
  default: () => ({ data: { resources: [] } }),
}));
vi.mock("~/components/PlatformLogo", () => ({ PlatformLogo: () => <div /> }));

mockRemixReact();
const methods = vi.hoisted(() => ({
  password: false,
  magicLink: true,
  google: false,
  microsoft: false,
  slack: false,
}));
vi.mock("~/api/queries/useLoginMethods", () => ({ useLoginMethods: () => ({ data: methods }) }));

it("hides the entire password form and separator while keeping magic link independent", () => {
  const Stub = createRemixStub([{ path: "/", Component: LoginPage }]);
  renderWith({ withQuery: true }).render(<Stub />);
  expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  expect(screen.queryByText(/Remember me/i)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Login" })).not.toBeInTheDocument();
  expect(screen.queryByText(/or continue with/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: /email me a login link/i })).toBeInTheDocument();
  expect(screen.queryByText(/Enter your email below/i)).not.toBeInTheDocument();
});
it("can hide magic link without hiding password login", () => {
  methods.password = true;
  methods.magicLink = false;
  const Stub = createRemixStub([{ path: "/", Component: LoginPage }]);
  renderWith({ withQuery: true }).render(<Stub />);
  expect(screen.getByLabelText("Email")).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: /email me a login link/i })).not.toBeInTheDocument();
  expect(screen.queryByText(/or continue with/i)).not.toBeInTheDocument();
  methods.password = false;
  methods.magicLink = true;
});

vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettingsSuspense: () => ({
    data: { enforceSSO: false },
  }),
}));

describe("Login page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: LoginPage,
    },
  ]);

  it("renders without crashing", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument();
  });

  it("shows only the current version as a changelog link", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    expect(screen.getByRole("link", { name: version })).toHaveAttribute(
      "href",
      `https://github.com/Selleo/mentingo/blob/main/CHANGELOG.md#${version}`,
    );
    expect(screen.queryByText(/App Version|Wersja aplikacji/i)).not.toBeInTheDocument();
  });

  it.skip("submits the form with valid data", async () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(mockedUseNavigate).toHaveBeenCalledWith("/");
    });
  });
});
