import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCourseAuthoringSession } from "./useCourseAuthoringSession";

const mocks = vi.hoisted(() => ({
  session: { data: undefined as undefined | { language: "en" } },
  context: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("~/api/queries/useCourseAuthoringSessionQuery", () => ({
  useCourseAuthoringSessionQuery: () => mocks.session,
  refreshAuthoringSession: mocks.refresh,
}));
vi.mock("~/api/queries/useCourseAuthoringContextQuery", () => ({
  useCourseAuthoringContextQuery: (...args: unknown[]) => mocks.context(...args),
}));
vi.mock("~/api/mutations/useCourseAuthoringCommand", () => ({
  useCourseAuthoringCommand: () => ({}),
}));

describe("restoring authoring context language", () => {
  beforeEach(() => {
    mocks.session.data = undefined;
    mocks.context.mockClear();
    mocks.refresh.mockClear();
  });

  it("waits for the saved session before requesting localized context", () => {
    renderHook(() => useCourseAuthoringSession("course", SUPPORTED_LANGUAGES.PL, "session"));
    expect(mocks.context).toHaveBeenLastCalledWith("course", SUPPORTED_LANGUAGES.PL, false);
  });

  it("uses the saved content language even when the interface is Polish", () => {
    const { rerender } = renderHook(() =>
      useCourseAuthoringSession("course", SUPPORTED_LANGUAGES.PL, "session"),
    );
    mocks.session.data = { language: SUPPORTED_LANGUAGES.EN };
    rerender();
    expect(mocks.context).toHaveBeenLastCalledWith("course", SUPPORTED_LANGUAGES.EN, true);
  });

  it("forwards recovery cancellation while preserving unguarded refresh callers", async () => {
    const controller = new AbortController();
    const { result } = renderHook(() =>
      useCourseAuthoringSession("course", SUPPORTED_LANGUAGES.PL, "session"),
    );

    await result.current.refetchSnapshot(controller.signal);
    expect(mocks.refresh).toHaveBeenLastCalledWith(
      "course",
      "session",
      undefined,
      controller.signal,
    );

    await result.current.refetchSnapshot();
    expect(mocks.refresh).toHaveBeenLastCalledWith("course", "session");
  });
});
