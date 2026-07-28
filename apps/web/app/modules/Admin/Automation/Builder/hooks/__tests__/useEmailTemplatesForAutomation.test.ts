import { useQuery } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the API client
vi.mock("~/api/api-client", () => ({
  ApiClient: {
    api: {
      emailNotificationTemplatesControllerListTemplates: vi.fn(),
    },
  },
}));

// Mock react-query — provide a minimal wrapper
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

import { useEmailTemplatesForAutomation } from "../useEmailTemplatesForAutomation";

const mockUseQuery = vi.mocked(useQuery);

describe("useEmailTemplatesForAutomation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty templates and loading=false when query has no data", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.templates).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("returns loading=true when query is loading", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.isLoading).toBe(true);
  });

  it("maps templates with extracted placeholders from blocks", () => {
    const mockData = [
      {
        id: "template-1",
        name: "Welcome Template",
        blocks: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Hello {{recipientName}}, welcome to {{platformName}}" },
              ],
            },
          ],
        },
        strings: {},
        subject: { en: "Welcome" },
      },
    ];

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].id).toBe("template-1");
    expect(result.current.templates[0].name).toBe("Welcome Template");
    expect(result.current.templates[0].isCustom).toBe(true);
    expect(result.current.templates[0].placeholders).toContain("recipientName");
    expect(result.current.templates[0].placeholders).toContain("platformName");
  });

  it("extracts placeholders from subject field", () => {
    const mockData = [
      {
        id: "template-2",
        name: "Subject Vars Template",
        blocks: { type: "doc", content: [] },
        strings: {},
        subject: { en: "Hello {{userName}}, your course {{courseName}}" },
      },
    ];

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.templates[0].placeholders).toContain("userName");
    expect(result.current.templates[0].placeholders).toContain("courseName");
  });

  it("deduplicates placeholders across blocks, strings, and subject", () => {
    const mockData = [
      {
        id: "template-3",
        name: "Dedup Template",
        blocks: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Hi {{name}}" }] }],
        },
        strings: {
          en: {
            "uuid-1": [{ type: "paragraph", content: [{ type: "text", text: "Hello {{name}}" }] }],
          },
        },
        subject: { en: "For {{name}}" },
      },
    ];

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    const nameOccurrences = result.current.templates[0].placeholders.filter(
      (p: string) => p === "name",
    );
    expect(nameOccurrences).toHaveLength(1);
  });

  it("returns empty placeholders when template has no variables", () => {
    const mockData = [
      {
        id: "template-4",
        name: "No Vars Template",
        blocks: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text: "Just plain text" }] }],
        },
        strings: {},
        subject: { en: "Simple Subject" },
      },
    ];

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.templates[0].placeholders).toEqual([]);
  });

  it("passes enabled=false to disable the query", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    renderHook(() => useEmailTemplatesForAutomation(false));

    expect(mockUseQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("extracts placeholders from attrs in blocks", () => {
    const mockData = [
      {
        id: "template-5",
        name: "Attrs Template",
        blocks: {
          type: "doc",
          content: [
            {
              type: "button",
              attrs: { href: "{{buttonLink}}", text: "Click {{action}}" },
              content: [],
            },
          ],
        },
        strings: {},
        subject: { en: "Test" },
      },
    ];

    mockUseQuery.mockReturnValue({
      data: mockData,
      isLoading: false,
    } as unknown as ReturnType<typeof useQuery>);

    const { result } = renderHook(() => useEmailTemplatesForAutomation());

    expect(result.current.templates[0].placeholders).toContain("buttonLink");
    expect(result.current.templates[0].placeholders).toContain("action");
  });
});
