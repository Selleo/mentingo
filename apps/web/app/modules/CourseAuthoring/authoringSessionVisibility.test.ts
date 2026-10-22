import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  authoringSessionVisibility,
  authoringSessionVisibilityKey,
  useVisibleAuthoringSession,
} from "./authoringSessionVisibility";

describe("authoring session visibility lifecycle", () => {
  beforeEach(() => authoringSessionVisibility.setState({}, true));

  it("releases visibility on close, session switch, and unmount", () => {
    const first = authoringSessionVisibilityKey("course", "first");
    const second = authoringSessionVisibilityKey("course", "second");
    const { rerender, unmount } = renderHook(
      ({ sessionId, open }) => useVisibleAuthoringSession("course", sessionId, open),
      { initialProps: { sessionId: "first", open: true } },
    );
    expect(authoringSessionVisibility.getState()).toEqual({ [first]: 1 });
    rerender({ sessionId: "second", open: true });
    expect(authoringSessionVisibility.getState()).toEqual({ [second]: 1 });
    rerender({ sessionId: "second", open: false });
    expect(authoringSessionVisibility.getState()).toEqual({});
    rerender({ sessionId: "second", open: true });
    unmount();
    expect(authoringSessionVisibility.getState()).toEqual({});
  });

  it("keeps a session visible while another host is still open", () => {
    const first = renderHook(() => useVisibleAuthoringSession("course", "session"));
    const second = renderHook(() => useVisibleAuthoringSession("course", "session"));
    first.unmount();
    expect(authoringSessionVisibility.getState()).toEqual({
      [authoringSessionVisibilityKey("course", "session")]: 1,
    });
    second.unmount();
    expect(authoringSessionVisibility.getState()).toEqual({});
  });
});
