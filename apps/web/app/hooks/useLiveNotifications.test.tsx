import { NOTIFICATION_SOCKET_EVENTS } from "@repo/shared";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ALL_ANNOUNCEMENTS_QUERY_KEY } from "~/api/queries/admin/useAllAnnouncements";
import { ANNOUNCEMENTS_FOR_USER_QUERY_KEY } from "~/api/queries/useAnnouncementsForUser";
import { UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY } from "~/api/queries/useUnreadAnnouncementsCount";
import { queryClient } from "~/api/queryClient";
import { fakeSocket } from "~/utils/mocks/socket.mock";

import { useLiveNotifications } from "./useLiveNotifications";

vi.mock("~/api/socket", async () => {
  const { fakeSocket } = await import("~/utils/mocks/socket.mock");

  return { acquireSocket: () => fakeSocket, releaseSocket: () => undefined };
});

const notificationQueryKeys = [
  [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY],
  [ANNOUNCEMENTS_FOR_USER_QUERY_KEY, { language: "en" }],
  [ALL_ANNOUNCEMENTS_QUERY_KEY, "infinite", { language: "en" }, 20],
];
const unrelatedQueryKey = ["courses"];

const isInvalidated = (queryKey: unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated;

describe("useLiveNotifications", () => {
  beforeEach(() => {
    queryClient.clear();
    fakeSocket.reset();

    for (const queryKey of [...notificationQueryKeys, unrelatedQueryKey]) {
      queryClient.setQueryData<object>(queryKey, {});
    }
  });

  it("joins the user's own room so the server can reach every open session", () => {
    renderHook(() => useLiveNotifications());

    expect(fakeSocket.emitted).toContainEqual(["join:user", undefined]);
  });

  it("refreshes the counter and the lists when a notification arrives", () => {
    renderHook(() => useLiveNotifications());

    fakeSocket.receive(NOTIFICATION_SOCKET_EVENTS.CREATED, {});

    expect(notificationQueryKeys.map(isInvalidated)).toEqual([true, true, true]);
    expect(isInvalidated(unrelatedQueryKey)).toBe(false);
  });

  it("refreshes after the connection comes back, for notifications missed meanwhile", () => {
    renderHook(() => useLiveNotifications());

    fakeSocket.receive("connect");

    expect(notificationQueryKeys.map(isInvalidated)).toEqual([true, true, true]);
  });

  it("stops listening when it is unmounted", () => {
    const { unmount } = renderHook(() => useLiveNotifications());
    unmount();

    fakeSocket.receive(NOTIFICATION_SOCKET_EVENTS.CREATED, {});

    expect(notificationQueryKeys.map(isInvalidated)).toEqual([false, false, false]);
  });
});
