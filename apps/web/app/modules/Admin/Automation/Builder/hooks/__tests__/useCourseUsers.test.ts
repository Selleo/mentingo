import { useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

vi.mock("~/api/queries/admin/useUsersEnrolled", () => ({
  useUsersEnrolledQuery: vi.fn().mockReturnValue({
    queryKey: ["users-enrolled", "course-1"],
    queryFn: vi.fn(),
  }),
}));

import { useCourseUsers } from "../useCourseUsers";

const mockUseQuery = vi.mocked(useQuery);

describe("useCourseUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty options when no data is loaded", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "course-1" }));

    expect(result.current.options).toEqual([]);
    expect(result.current.students).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns isLoading=true when query is loading with courseId", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "course-1" }));

    expect(result.current.isLoading).toBe(true);
  });

  it("returns isLoading=false when no courseId provided regardless of query state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({}));

    expect(result.current.isLoading).toBe(false);
  });

  it("filters by all_enrolled mode (default) — returns all students", () => {
    const mockStudents = [
      { id: "s1", firstName: "Jan", lastName: "K", email: "jan@t.com", completedAt: null },
      {
        id: "s2",
        firstName: "Anna",
        lastName: "N",
        email: "anna@t.com",
        completedAt: "2025-01-01",
      },
    ];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1" }));

    expect(result.current.students).toHaveLength(2);
  });

  it("filters by organization mode — only org members", () => {
    const mockStudents = [
      { id: "s1", firstName: "Jan", lastName: "K", email: "jan@t.com", isOrganizationMember: true },
      {
        id: "s2",
        firstName: "Anna",
        lastName: "N",
        email: "anna@t.com",
        isOrganizationMember: false,
      },
    ];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1", mode: "organization" }));

    expect(result.current.students).toHaveLength(1);
    expect(result.current.students[0].id).toBe("s1");
  });

  it("filters by in_progress mode — only students without completedAt", () => {
    const mockStudents = [
      { id: "s1", firstName: "Jan", lastName: "K", email: "jan@t.com", completedAt: null },
      {
        id: "s2",
        firstName: "Anna",
        lastName: "N",
        email: "anna@t.com",
        completedAt: "2025-01-01",
      },
    ];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1", mode: "in_progress" }));

    expect(result.current.students).toHaveLength(1);
    expect(result.current.students[0].id).toBe("s1");
  });

  it("filters by inactive_for_days mode with default threshold (7 days)", () => {
    const now = Date.now();
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString();

    const mockStudents = [
      {
        id: "s1",
        firstName: "Jan",
        lastName: "K",
        email: "jan@t.com",
        lastLessonCompletedAt: tenDaysAgo,
      },
      {
        id: "s2",
        firstName: "Anna",
        lastName: "N",
        email: "anna@t.com",
        lastLessonCompletedAt: twoDaysAgo,
      },
      {
        id: "s3",
        firstName: "Piotr",
        lastName: "W",
        email: "piotr@t.com",
        lastLessonCompletedAt: null,
      },
    ];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() =>
      useCourseUsers({ courseId: "c1", mode: "inactive_for_days" }),
    );

    // s1 (10 days ago > 7) and s3 (null = always inactive) should pass
    expect(result.current.students).toHaveLength(2);
    const ids = result.current.students.map((s: { id: string }) => s.id);
    expect(ids).toContain("s1");
    expect(ids).toContain("s3");
  });

  it("respects custom inactiveDaysThreshold", () => {
    const now = Date.now();
    const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString();

    const mockStudents = [
      {
        id: "s1",
        firstName: "Jan",
        lastName: "K",
        email: "jan@t.com",
        lastLessonCompletedAt: fiveDaysAgo,
      },
    ];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() =>
      useCourseUsers({ courseId: "c1", mode: "inactive_for_days", inactiveDaysThreshold: 3 }),
    );

    // 5 days ago >= 3 threshold → included
    expect(result.current.students).toHaveLength(1);
  });

  it("maps students to Option format with full name as label", () => {
    const mockStudents = [{ id: "s1", firstName: "Jan", lastName: "Kowalski", email: "jan@t.com" }];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1" }));

    expect(result.current.options).toHaveLength(1);
    expect(result.current.options[0].value).toBe("s1");
    expect(result.current.options[0].label).toBe("Jan Kowalski");
  });

  it("falls back to email when name is empty", () => {
    const mockStudents = [{ id: "s1", firstName: "", lastName: "", email: "jan@t.com" }];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1" }));

    expect(result.current.options[0].label).toBe("jan@t.com");
  });

  it("falls back to id when both name and email are empty", () => {
    const mockStudents = [{ id: "s1", firstName: "", lastName: "", email: "" }];

    mockUseQuery.mockReturnValue({
      data: { data: mockStudents },
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useCourseUsers({ courseId: "c1" }));

    expect(result.current.options[0].label).toBe("s1");
  });
});
