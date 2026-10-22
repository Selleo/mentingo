import {
  GLOBAL_SEARCH_MODES,
  type GlobalSearchSemanticStatus,
  GLOBAL_SEARCH_SEMANTIC_STATUSES,
} from "@repo/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalSearchResults } from "./GlobalSearchResults";

const search = vi.hoisted(() => ({
  data: {
    results: [
      { type: "article", id: "article", title: "A result" },
      { type: "learningPath", id: "path", title: "Hidden path", courseCount: 1 },
    ],
    users: [],
    groups: [],
    categories: [],
    semanticStatus: undefined as GlobalSearchSemanticStatus | undefined,
  },
  isFetching: false,
  isError: false,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("~/api/queries/useGlobalSearch", () => ({ useGlobalSearch: () => search }));
vi.mock("~/api/queries/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ data: { learningPathsEnabled: false } }),
}));
vi.mock("~/modules/Dashboard/Settings/Language/LanguageStore", () => ({
  useLanguageStore: (selector: (state: { language: string }) => unknown) =>
    selector({ language: "en" }),
}));
vi.mock("./GlobalSearchContent", () => ({
  GlobalSearchContent: ({
    isFetching,
    results,
  }: {
    isFetching: boolean;
    results: { title: string }[];
  }) => (
    <div>
      {isFetching && <span>Loading</span>}
      {results.map((node) => (
        <span key={node.title}>{node.title}</span>
      ))}
    </div>
  ),
}));

const props = {
  debouncedSearch: "meaning",
  mode: GLOBAL_SEARCH_MODES.HYBRID,
  onSelect: vi.fn(),
  activeIndex: 0,
  setTotalItems: vi.fn(),
};

describe("hybrid search feedback", () => {
  beforeEach(() => {
    search.isFetching = false;
    search.isError = false;
    search.data.semanticStatus = GLOBAL_SEARCH_SEMANTIC_STATUSES.READY;
  });
  it("shows keyword fallback with results when semantic search is unavailable", () => {
    search.data.semanticStatus = GLOBAL_SEARCH_SEMANTIC_STATUSES.UNAVAILABLE;
    render(<GlobalSearchResults {...props} />);
    expect(screen.getByRole("status")).toHaveTextContent("globalSearch.semanticUnavailable");
    expect(screen.getByText("A result")).toBeInTheDocument();
  });
  it("leaves out learning paths when they are disabled", () => {
    render(<GlobalSearchResults {...props} />);
    expect(screen.getByText("A result")).toBeInTheDocument();
    expect(screen.queryByText("Hidden path")).not.toBeInTheDocument();
  });
  it("does not warn about partially indexed content", () => {
    search.data.semanticStatus = GLOBAL_SEARCH_SEMANTIC_STATUSES.PENDING;
    render(<GlobalSearchResults {...props} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("A result")).toBeInTheDocument();
  });
  it("hides stale results while the new input debounces", () => {
    render(<GlobalSearchResults {...props} isDebouncing />);
    expect(screen.queryByText("A result")).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
  it("hides cached results while fetching", () => {
    search.isFetching = true;
    render(<GlobalSearchResults {...props} />);
    expect(screen.queryByText("A result")).not.toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });
  it("shows a failure instead of reporting no matches", () => {
    search.isError = true;
    render(<GlobalSearchResults {...props} />);
    expect(screen.getByRole("alert")).toHaveTextContent("globalSearch.searchFailed");
    expect(screen.queryByText("A result")).not.toBeInTheDocument();
  });
});
