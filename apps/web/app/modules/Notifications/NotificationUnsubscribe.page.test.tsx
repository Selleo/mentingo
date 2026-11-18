import { createRemixStub } from "@remix-run/testing";
import { DISCUSSION_UNSUBSCRIBE_TYPES } from "@repo/shared";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { renderWith } from "~/utils/testUtils";

import { NOTIFICATIONS_HANDLES } from "./handles";
import NotificationUnsubscribePage from "./NotificationUnsubscribe.page";

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { discussionNotificationsControllerUnsubscribe: vi.fn() } },
}));

const renderPage = (url: string) => {
  const RemixStub = createRemixStub([
    { path: "/notifications/unsubscribe", Component: NotificationUnsubscribePage },
  ]);

  return renderWith().render(
    <QueryClientProvider client={queryClient}>
      <RemixStub initialEntries={[url]} />
    </QueryClientProvider>,
  );
};

describe("NotificationUnsubscribePage", () => {
  beforeEach(() => {
    queryClient.clear();
    vi.clearAllMocks();
  });

  it("changes nothing until the visitor confirms, then says what was turned off", async () => {
    vi.mocked(ApiClient.api.discussionNotificationsControllerUnsubscribe).mockResolvedValue({
      data: { data: { type: DISCUSSION_UNSUBSCRIBE_TYPES.MENTIONS } },
    } as never);

    renderPage("/notifications/unsubscribe?token=signed-token");

    expect(ApiClient.api.discussionNotificationsControllerUnsubscribe).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId(NOTIFICATIONS_HANDLES.UNSUBSCRIBE_CONFIRM_BUTTON));

    expect(await screen.findByText("You will no longer get emails about mentions.")).toBeVisible();
    expect(ApiClient.api.discussionNotificationsControllerUnsubscribe).toHaveBeenCalledWith({
      token: "signed-token",
    });
    expect(
      screen.queryByTestId(NOTIFICATIONS_HANDLES.UNSUBSCRIBE_CONFIRM_BUTTON),
    ).not.toBeInTheDocument();
  });

  it("reports a link the server rejects", async () => {
    vi.mocked(ApiClient.api.discussionNotificationsControllerUnsubscribe).mockRejectedValue(
      new AxiosError("Bad request", undefined, undefined, undefined, { status: 400 } as never),
    );

    renderPage("/notifications/unsubscribe?token=expired-token");
    fireEvent.click(screen.getByTestId(NOTIFICATIONS_HANDLES.UNSUBSCRIBE_CONFIRM_BUTTON));

    expect(await screen.findByText("This link is invalid or has expired.")).toBeVisible();
  });

  it("offers nothing to confirm when the link carries no token", () => {
    renderPage("/notifications/unsubscribe");

    expect(screen.getByTestId(NOTIFICATIONS_HANDLES.UNSUBSCRIBE_MESSAGE)).toHaveTextContent(
      "This link is invalid or has expired.",
    );
    expect(
      screen.queryByTestId(NOTIFICATIONS_HANDLES.UNSUBSCRIBE_CONFIRM_BUTTON),
    ).not.toBeInTheDocument();
  });
});
