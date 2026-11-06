import { createRemixStub } from "@remix-run/testing";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { queryClient } from "~/api/queryClient";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { MFA_URL } from "~/modules/Auth/constants";
import { server } from "~/utils/mocks/node";

import { useUpdateMFAEnforcedRoles } from "./useUpdateMFAEnforcedRoles";

import type { AuthSessionStatus } from "@repo/shared";

const SETTINGS_PATH = "/settings?tab=organization";

function SaveEnforcement() {
  const { mutate } = useUpdateMFAEnforcedRoles();
  return <button onClick={() => mutate({ admin: true })}>Save</button>;
}

function renderSettings(sessionStatus: AuthSessionStatus) {
  server.use(
    http.patch("http://localhost:3000/api/settings/admin/mfa-enforced-roles", () =>
      HttpResponse.json({ data: {} }),
    ),
    http.get("http://localhost:3000/api/auth/session", () =>
      HttpResponse.json({ data: { status: sessionStatus } }),
    ),
  );
  const App = createRemixStub([
    { path: "/settings", Component: SaveEnforcement },
    { path: MFA_URL, Component: () => <div>MFA challenge</div> },
  ]);
  render(
    <QueryClientProvider client={queryClient}>
      <App initialEntries={[SETTINGS_PATH]} />
    </QueryClientProvider>,
  );
}

describe("MFA enforcement update", () => {
  beforeEach(() => useNavigationHistoryStore.getState().clearHistory());
  afterEach(() => queryClient.clear());

  it("sends an admin who enforced MFA on their own role to verification and back", async () => {
    renderSettings(AUTH_SESSION_STATUS.MFA_REQUIRED);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByText("MFA challenge")).toBeVisible();
    expect(useNavigationHistoryStore.getState().navigationHistory[0]?.pathname).toBe(SETTINGS_PATH);
  });

  it("keeps the admin on settings when their session already satisfies MFA", async () => {
    renderSettings(AUTH_SESSION_STATUS.AUTHENTICATED);
    fireEvent.click(await screen.findByRole("button", { name: "Save" }));

    expect(await screen.findByRole("button", { name: "Save" })).toBeVisible();
    expect(screen.queryByText("MFA challenge")).toBeNull();
    expect(useNavigationHistoryStore.getState().navigationHistory).toEqual([]);
  });
});
