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
});
