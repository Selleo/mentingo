import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/api/queries/useCourses", () => ({
  useCourses: vi.fn(),
}));

import { useCourses } from "~/api/queries/useCourses";

import { useCoursesOptions } from "../useCourses";

const mockUseCourses = vi.mocked(useCourses);

describe("useCoursesOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty options when no courses are loaded", () => {
    mockUseCourses.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown);

    const { result } = renderHook(() => useCoursesOptions());

    expect(result.current.options).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns isLoading=true when courses are loading", () => {
    mockUseCourses.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown);

    const { result } = renderHook(() => useCoursesOptions());

    expect(result.current.isLoading).toBe(true);
  });

  it("maps courses to options with value, label, and imageUrl", () => {
    mockUseCourses.mockReturnValue({
      data: [
        { id: "course-1", title: "BHP Training", thumbnailUrl: "https://cdn.test.com/img1.jpg" },
        { id: "course-2", title: "Fire Safety", thumbnailUrl: null },
      ],
      isLoading: false,
    } as unknown);

    const { result } = renderHook(() => useCoursesOptions());

    expect(result.current.options).toHaveLength(2);
    expect(result.current.options[0]).toEqual({
      value: "course-1",
      label: "BHP Training",
      imageUrl: "https://cdn.test.com/img1.jpg",
    });
    expect(result.current.options[1]).toEqual({
      value: "course-2",
      label: "Fire Safety",
      imageUrl: undefined,
    });
  });

  it("handles empty course list", () => {
    mockUseCourses.mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown);

    const { result } = renderHook(() => useCoursesOptions());

    expect(result.current.options).toEqual([]);
  });
});
