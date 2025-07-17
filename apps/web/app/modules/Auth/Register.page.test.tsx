import { createRemixStub } from "@remix-run/testing";
import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { mockedUseNavigate, mockRemixReact } from "~/utils/mocks/remix-run-mock";
import { renderWith } from "~/utils/testUtils";

import RegisterPage from "./Register.page";

vi.mock("../../../api/api-client");

mockRemixReact();

describe.skip("Register page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: RegisterPage,
    },
  ]);

  it("renders without crashing", () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    expect(screen.getByRole("heading", { name: "Sign Up" })).toBeInTheDocument();
  });

  it("submits the form with valid data", async () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    const user = userEvent.setup();

    await user.type(screen.getByLabelText("First name"), "Name");
    await user.type(screen.getByLabelText("Last name"), "Surname");
    await user.type(screen.getByLabelText("Email"), "test@example.com");
    await user.type(screen.getByLabelText("Password"), "Password123@");

    await user.click(screen.getByRole("button", { name: "Create an account" }));

    await waitFor(() => {
      expect(mockedUseNavigate).toHaveBeenCalledWith("/auth/login");
    });
  });

  it("displays error messages for invalid inputs", async () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Create an account" }));

    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  it("navigates to login page when 'Sign in' link is clicked", async () => {
    renderWith({ withQuery: true }).render(<RemixStub />);

    const signInLink = screen.getByRole("link", { name: "Sign in" });
    expect(signInLink).toHaveAttribute("href", "/auth/login");
  });
});
