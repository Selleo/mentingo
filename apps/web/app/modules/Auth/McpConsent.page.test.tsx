import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import McpConsentPage from "./McpConsent.page";

const connection = vi.hoisted(() => ({ scope: "search" }));
vi.mock("~/api/queries/useMcpConsent", () => ({
  useMcpConsent: () => ({
    data: {
      clientName: "Search assistant",
      accountEmail: "reader@example.test",
      redirectUri: "https://bot.example.test/mentingo/oauth/callback",
      scope: connection.scope,
    },
    isLoading: false,
    error: null,
  }),
}));
vi.mock("~/api/queries/useGlobalSettings", () => ({ useGlobalSettings: () => ({ data: {} }) }));
vi.mock("~/components/PlatformLogo", () => ({ PlatformLogo: () => <div /> }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "mcpConnection.searchDescription") return "Search only; cannot modify content.";
      if (key === "mcpConnection.description") return "Use Mentingo with your current permissions.";
      return key;
    },
  }),
}));

describe("MCP consent scope", () => {
  it("explains the read-only restriction before allowing a search connection", () => {
    connection.scope = "search";
    render(
      <MemoryRouter initialEntries={["/oauth/connect?consent=nonce"]}>
        <McpConsentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Search only; cannot modify content.")).toBeInTheDocument();
    expect(
      screen.queryByText("Use Mentingo with your current permissions."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "mcpConnection.allow" })).toBeInTheDocument();
  });

  it("does not promise read-only access for an authoring connection", () => {
    connection.scope = "authoring";
    render(
      <MemoryRouter initialEntries={["/oauth/connect?consent=nonce"]}>
        <McpConsentPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Use Mentingo with your current permissions.")).toBeInTheDocument();
    expect(screen.queryByText("Search only; cannot modify content.")).not.toBeInTheDocument();
  });
});
