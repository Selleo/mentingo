import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AUTHORING_CONNECTION_STATE } from "../courseAuthoring.constants";

import { AuthoringConnectionNotice } from "./AuthoringConnectionNotice";

describe("AuthoringConnectionNotice", () => {
  it("does not interrupt a live session with a connection notice", () => {
    renderWith().render(
      <AuthoringConnectionNotice
        connection={AUTHORING_CONNECTION_STATE.LIVE}
        onReconnect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([AUTHORING_CONNECTION_STATE.CONNECTING, AUTHORING_CONNECTION_STATE.RECOVERING])(
    "explains automatic recovery without allowing duplicate retry for %s",
    (connection) => {
      renderWith().render(
        <AuthoringConnectionNotice connection={connection} onReconnect={vi.fn()} />,
      );

      expect(screen.getByRole("status")).toHaveTextContent("Reconnecting. Your work is saved.");
      expect(screen.queryByRole("button")).toBeNull();
    },
  );

  it("allows the author to retry a disconnected session", async () => {
    const onReconnect = vi.fn();
    const user = userEvent.setup();
    renderWith().render(
      <AuthoringConnectionNotice
        connection={AUTHORING_CONNECTION_STATE.OFFLINE}
        onReconnect={onReconnect}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Connection lost. Your work is saved.");
    await user.click(screen.getByRole("button", { name: "Reconnect" }));
    expect(onReconnect).toHaveBeenCalledOnce();
  });

  it.each([
    [
      AUTHORING_CONNECTION_STATE.PERMISSION_REVOKED,
      "You no longer have access to this course generation session.",
    ],
    [
      AUTHORING_CONNECTION_STATE.SESSION_UNAVAILABLE,
      "This course generation session is no longer available.",
    ],
  ] as const)(
    "explains %s without offering a retry that cannot restore access",
    (connection, message) => {
      renderWith().render(
        <AuthoringConnectionNotice connection={connection} onReconnect={vi.fn()} />,
      );

      expect(screen.getByRole("status")).toHaveTextContent(message);
      expect(screen.queryByText("Reconnecting. Your work is saved.")).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
    },
  );
});
