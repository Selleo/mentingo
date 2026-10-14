import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import McpConsentPage from "./McpConsent.page";

const connection = vi.hoisted(() => ({ scopes: ["student:read"] }));
vi.mock("~/api/queries/useMcpConsent", () => ({
  useMcpConsent: () => ({
    data: {
      clientName: "Assistant",
      accountEmail: "reader@example.test",
      redirectUri: "https://bot.example.test/mentingo/oauth/callback",
      scopes: connection.scopes,
    },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({ useGlobalSettings: () => ({ data: {} }) }));
vi.mock("~/components/PlatformLogo", () => ({ PlatformLogo: () => <div /> }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("MCP consent scopes", () => {
  it("explains permission-aware account access and requires approval", () => {
    connection.scopes = ["account:access"];
    render(
      <MemoryRouter initialEntries={["/oauth/connect?consent=nonce"]}>
        <McpConsentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("mcpConnection.accountDescription")).toBeInTheDocument();
    expect(screen.getByText("account:access")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mcpConnection.allow" })).toHaveAttribute(
      "value",
      "approve",
    );
    expect(screen.getByRole("button", { name: "mcpConnection.deny" })).toHaveAttribute(
      "value",
      "deny",
    );
  });

  it("explains student access and requires an explicit approval", () => {
    connection.scopes = ["student:read"];
    render(
      <MemoryRouter initialEntries={["/oauth/connect?consent=nonce"]}>
        <McpConsentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("mcpConnection.studentDescription")).toBeInTheDocument();
    expect(screen.getByText("student:read")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mcpConnection.allow" })).toHaveAttribute(
      "value",
      "approve",
    );
    expect(screen.getByRole("button", { name: "mcpConnection.deny" })).toHaveAttribute(
      "value",
      "deny",
    );
  });

  it("shows every granular permission without promising learner visibility", () => {
    connection.scopes = ["courses:read", "articles:write", "files:write"];
    render(
      <MemoryRouter initialEntries={["/oauth/connect?consent=nonce"]}>
        <McpConsentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("mcpConnection.explicitDescription")).toBeInTheDocument();
    for (const scope of connection.scopes) expect(screen.getByText(scope)).toBeInTheDocument();
    expect(screen.queryByText("mcpConnection.studentDescription")).not.toBeInTheDocument();
  });
});
