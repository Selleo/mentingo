import "~/utils/mocks/i18next.mock";

import { SESSION_REVOCATION_SOCKET } from "@repo/shared";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSocket } from "~/utils/mocks/socket.mock";

import { useSessionRevocationNotifications } from "./useSessionRevocationNotifications";

const mocks = vi.hoisted(() => ({ refreshToken: vi.fn(), toast: vi.fn() }));

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});
vi.mock("~/modules/Auth/authService", () => ({
  authService: { refreshToken: mocks.refreshToken },
}));
vi.mock("~/components/ui/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }));

const receivePermissionsUpdated = () =>
  fakeSocket.receive(SESSION_REVOCATION_SOCKET.EVENTS.PERMISSIONS_UPDATED, {
    reason: SESSION_REVOCATION_SOCKET.REASONS.ROLES_CHANGED,
  });

describe("useSessionRevocationNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeSocket.reset();
    fakeSocket.connected = true;
  });

  it.each([
    ["succeeds", () => mocks.refreshToken.mockResolvedValue(undefined)],
    ["fails", () => mocks.refreshToken.mockRejectedValue(new Error("refresh failed"))],
  ])("reconnects the socket when the permission refresh %s", async (_case, arrangeRefresh) => {
    arrangeRefresh();
    renderHook(() => useSessionRevocationNotifications());
    const connect = vi.spyOn(fakeSocket, "connect");

    receivePermissionsUpdated();

    await waitFor(() => expect(connect).toHaveBeenCalledTimes(1));
  });

  it("refreshes once while a refresh is already running", async () => {
    mocks.refreshToken.mockReturnValue(new Promise(() => undefined));
    renderHook(() => useSessionRevocationNotifications());

    receivePermissionsUpdated();
    receivePermissionsUpdated();

    expect(mocks.refreshToken).toHaveBeenCalledTimes(1);
  });
});
