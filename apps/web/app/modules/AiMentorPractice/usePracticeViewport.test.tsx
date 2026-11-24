import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { usePracticeViewport } from "./usePracticeViewport";

function PracticeViewport() {
  return <div ref={usePracticeViewport()} />;
}

it("resizes the practice area to the keyboard viewport below the navigation", () => {
  const viewport = Object.assign(new EventTarget(), { height: 780, offsetTop: 0 });
  vi.stubGlobal("visualViewport", viewport);
  const bounds = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 56,
  } as DOMRect);

  try {
    const { container, unmount } = render(<PracticeViewport />);
    const practice = container.querySelector("div");
    expect(practice?.style.getPropertyValue("--practice-viewport-height")).toBe("724px");

    act(() => {
      viewport.height = 460;
      viewport.dispatchEvent(new Event("resize"));
    });
    expect(practice?.style.getPropertyValue("--practice-viewport-height")).toBe("404px");

    act(() => {
      viewport.offsetTop = 20;
      viewport.dispatchEvent(new Event("scroll"));
    });
    expect(practice?.style.getPropertyValue("--practice-viewport-height")).toBe("424px");
    unmount();

    bounds.mockClear();
    viewport.dispatchEvent(new Event("resize"));
    expect(bounds).not.toHaveBeenCalled();
  } finally {
    bounds.mockRestore();
    vi.unstubAllGlobals();
  }
});
