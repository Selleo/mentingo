import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearchContent } from "./GlobalSearchContent";

import type { GlobalSearchItem } from "./GlobalSearchContent";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const renderContent = (resultType: "articles" | "users", isFetching = false) => {
  const items = [
    {
      resultType,
      resultData: [
        {
          id: "id",
          title: "Title",
          matchedPassage: "<script>safe text</script>",
          matchedAttachmentFileName: "policy.pdf",
        },
      ],
      Component: () => <span>Title</span>,
    },
  ] as unknown as GlobalSearchItem[];
  return render(
    <GlobalSearchContent
      tabsToDisplay={{ isFetching, items }}
      onSelect={vi.fn()}
      activeIndex={-1}
      setTotalItems={vi.fn()}
    />,
  );
};

describe("result presentation", () => {
  it("shows escaped matching evidence alongside the result", () => {
    const { container } = renderContent("articles");
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("<script>safe text</script>")).toBeInTheDocument();
    expect(screen.getByText("policy.pdf")).toBeInTheDocument();
    expect(container.querySelector("script")).toBeNull();
  });
  it("does not display passages or attachment metadata for users", () => {
    renderContent("users");
    expect(screen.queryByText("<script>safe text</script>")).not.toBeInTheDocument();
    expect(screen.queryByText("policy.pdf")).not.toBeInTheDocument();
  });
  it("announces loading without displaying previous results", () => {
    renderContent("articles", true);
    expect(screen.getByRole("status", { name: "globalSearch.loading" })).toBeInTheDocument();
    expect(screen.queryByText("Title")).not.toBeInTheDocument();
  });
});

it("ranks content across types, deduplicates course destinations and keeps keyboard indices aligned", () => {
  const setTotalItems = vi.fn();
  const entry = ({ item }: { item: { title: string } }) => <a href="#result">{item.title}</a>;
  const items = [
    {
      resultType: "allCourses",
      resultData: [{ id: "same", title: "Preferred course", relevanceScore: 0.4 }],
      Component: entry,
    },
    {
      resultType: "myCourses",
      resultData: [{ id: "same", title: "Duplicate course", relevanceScore: 0.4 }],
      Component: entry,
    },
    {
      resultType: "lessons",
      resultData: [{ id: "same", title: "Lesson", relevanceScore: 0.3 }],
      Component: entry,
    },
    { resultType: "users", resultData: [{ id: "user", title: "Person" }], Component: entry },
    {
      resultType: "articles",
      resultData: [
        {
          id: "article",
          title: "Best file match",
          relevanceScore: 0.9,
          matchedAttachmentFileName: "guide.pptx",
        },
      ],
      Component: entry,
    },
  ] as unknown as GlobalSearchItem[];
  const { container } = render(
    <GlobalSearchContent
      tabsToDisplay={{ isFetching: false, items }}
      onSelect={vi.fn()}
      activeIndex={-1}
      setTotalItems={setTotalItems}
    />,
  );
  const rows = Array.from(container.querySelectorAll("[data-search-index]"));
  expect(rows.map((row) => row.querySelector("a")?.textContent)).toEqual([
    "Best file match",
    "Preferred course",
    "Lesson",
    "Person",
  ]);
  expect(rows.map((row) => row.getAttribute("data-search-index"))).toEqual(["0", "1", "2", "3"]);
  expect(rows[0]).toHaveTextContent("globalSearch.entries.articles");
  expect(rows[0]).toHaveTextContent("guide.pptx");
  expect(rows[2]).toHaveTextContent("globalSearch.entries.lessons");
  expect(
    screen.getByRole("heading", { name: "globalSearch.administrativeResults" }),
  ).toBeInTheDocument();
  expect(setTotalItems).toHaveBeenLastCalledWith(4);
  expect(screen.queryByText("Duplicate course")).not.toBeInTheDocument();
});

it("preserves content order when a legacy response has no relevance scores", () => {
  const entry = ({ item }: { item: { title: string } }) => <span>{item.title}</span>;
  const items = [
    { resultType: "lessons", resultData: [{ id: "lesson", title: "Lesson" }], Component: entry },
    { resultType: "articles", resultData: [{ id: "article", title: "Article" }], Component: entry },
  ] as unknown as GlobalSearchItem[];
  const { container } = render(
    <GlobalSearchContent
      tabsToDisplay={{ isFetching: false, items }}
      onSelect={vi.fn()}
      activeIndex={-1}
      setTotalItems={vi.fn()}
    />,
  );
  const rows = container.querySelectorAll("[data-search-index]");
  expect(rows[0]).toHaveTextContent("Lesson");
  expect(rows[1]).toHaveTextContent("Article");
});
