import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePageTitle } from "./usePageTitle";

vi.mock("~/api/queries/useCompanyInformation", () => ({
  useCompanyInformation: () => ({ data: { data: { companyName: "Acme" } } }),
}));

describe("usePageTitle", () => {
  beforeEach(() => {
    document.head.innerHTML = "<title>Lesson – Acme</title>";
  });

  it("keeps the data-driven title when route metadata re-renders the title element", async () => {
    const { unmount } = renderHook(() => usePageTitle(["Lesson 1", "Course A"]));

    expect(document.title).toBe("Lesson 1 – Course A – Acme");

    document.title = "Lesson – Acme";
    await waitFor(() => expect(document.title).toBe("Lesson 1 – Course A – Acme"));

    unmount();
    document.title = "Courses – Acme";
    await Promise.resolve();
    expect(document.title).toBe("Courses – Acme");
  });

  it("restores the route title on unmount so the next route does not keep the lesson title", () => {
    const { unmount } = renderHook(() => usePageTitle(["Lesson 1", "Course A"]));

    unmount();

    expect(document.title).toBe("Lesson – Acme");
  });

  it("keeps a title the next route committed together with the unmount", () => {
    const { unmount } = renderHook(() => usePageTitle(["Lesson 1", "Course A"]));

    document.title = "Forum – Acme";
    unmount();

    expect(document.title).toBe("Forum – Acme");
  });

  it("enforces the new title after the parts change", async () => {
    const { rerender } = renderHook(({ parts }) => usePageTitle(parts), {
      initialProps: { parts: ["Lesson 1", "Course A"] },
    });

    rerender({ parts: ["Lesson 2", "Course A"] });
    expect(document.title).toBe("Lesson 2 – Course A – Acme");

    document.title = "Lesson – Acme";
    await waitFor(() => expect(document.title).toBe("Lesson 2 – Course A – Acme"));
  });

  it("restores the data-driven title when route metadata replaces the title element", async () => {
    renderHook(() => usePageTitle(["Lesson 1", "Course A"]));

    const replacement = document.createElement("title");

    replacement.textContent = "Lesson – Acme";
    document.head.querySelector("title")?.replaceWith(replacement);

    await waitFor(() => expect(document.title).toBe("Lesson 1 – Course A – Acme"));
  });
});
