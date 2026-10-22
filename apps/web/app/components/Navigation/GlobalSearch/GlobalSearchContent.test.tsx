import { createRemixStub } from "@remix-run/testing";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearchContent } from "./GlobalSearchContent";

import type {
  GlobalSearchAdministrativeResults,
  GlobalSearchResultNode,
} from "./globalSearchNodes";
import type { ComponentProps } from "react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

const noAdministrative: GlobalSearchAdministrativeResults = {
  users: [],
  groups: [],
  categories: [],
};

const renderContent = (props: Partial<ComponentProps<typeof GlobalSearchContent>> = {}) => {
  const setTotalItems = vi.fn();
  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: () => (
        <GlobalSearchContent
          isFetching={false}
          results={[]}
          administrative={noAdministrative}
          onSelect={vi.fn()}
          activeIndex={-1}
          setTotalItems={setTotalItems}
          {...props}
        />
      ),
    },
  ]);
  const view = render(<RemixStub />);
  return { ...view, setTotalItems };
};

const courseWithLessons: GlobalSearchResultNode = {
  type: "course",
  id: "course",
  title: "Workplace safety",
  category: "Safety",
  matched: false,
  relevanceScore: 0.9,
  hiddenLessonCount: 2,
  lessons: [
    {
      type: "lesson",
      id: "lesson-1",
      title: "Fire exits",
      courseId: "course",
      chapterTitle: "Evacuation",
      relevanceScore: 0.9,
    },
    {
      type: "lesson",
      id: "lesson-2",
      title: "Assembly points",
      courseId: "course",
      relevanceScore: 0.4,
    },
  ],
};

const rowsOf = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("[data-search-index]"));

describe("result tree", () => {
  it("nests lessons under their course and keeps one keyboard order across sections", async () => {
    const { container, setTotalItems } = renderContent({
      results: [
        courseWithLessons,
        { type: "article", id: "article", title: "Fire safety policy", relevanceScore: 0.3 },
      ],
      administrative: {
        users: [
          {
            id: "user",
            firstName: "Sam",
            lastName: "Safety",
            email: "sam@example.test",
            groups: [],
          },
        ],
        groups: [{ id: "group", name: "Safety officers" }],
        categories: [{ id: "category", title: "Safety" }],
      },
    });

    await screen.findByText("Workplace safety");
    const rows = rowsOf(container);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Workplace safety"),
      expect.stringContaining("Fire exits"),
      expect.stringContaining("Assembly points"),
      expect.stringContaining("globalSearch.moreInCourse:2"),
      expect.stringContaining("Fire safety policy"),
      expect.stringContaining("Sam Safety"),
      expect.stringContaining("Safety officers"),
      expect.stringContaining("Safety"),
    ]);
    expect(rows.map((row) => row.dataset.searchIndex)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
    ]);
    expect(rows.map((row) => row.classList.contains("border-l"))).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(rows[1]).toHaveTextContent("Evacuation");
    expect(rows[1]).toHaveTextContent("globalSearch.types.lesson");
    expect(within(rows[3]).getByRole("link")).toHaveAttribute("href", "/course/course");
    expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
      "globalSearch.contentResults",
      "globalSearch.entries.users",
      "globalSearch.entries.groups",
      "globalSearch.entries.categories",
    ]);
    // The section heading names the kind, so administrative rows carry no type label.
    expect(rows[5]).not.toHaveTextContent("globalSearch.types");
    expect(setTotalItems).toHaveBeenLastCalledWith(8);
  });

  it("shows an excerpt only when the title does not already explain the match", async () => {
    renderContent({
      query: "policy",
      results: [
        { type: "article", id: "a", title: "Travel policy", matchedPassage: "policy repeated" },
        { type: "news", id: "b", title: "Onboarding", matchedPassage: "policy explained" },
        {
          type: "qa",
          id: "c",
          title: "Policy deck",
          matchedPassage: "policy in file",
          matchedAttachmentFileName: "deck.pptx",
        },
      ],
    });

    expect(await screen.findByText("policy explained")).toBeInTheDocument();
    expect(screen.queryByText("policy repeated")).not.toBeInTheDocument();
    expect(screen.getByText("policy in file")).toBeInTheDocument();
    expect(screen.getByText("deck.pptx")).toBeInTheDocument();
  });

  it("omits the section heading when only one keyword section is shown", async () => {
    renderContent({ results: [{ type: "article", id: "a", title: "Article" }] });
    await screen.findByText("Article");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("does not label AI results with a separate heading", async () => {
    renderContent({ results: [{ type: "article", id: "a", title: "Article" }], isAiRanked: true });
    await screen.findByText("Article");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it("announces loading without displaying previous results", async () => {
    renderContent({ isFetching: true, results: [courseWithLessons] });
    expect(await screen.findByRole("status", { name: "globalSearch.loading" })).toBeInTheDocument();
    expect(screen.queryByText("Workplace safety")).not.toBeInTheDocument();
  });

  it("offers the empty-state action", async () => {
    const onClick = vi.fn();
    renderContent({ emptyAction: { label: "Back", onClick } });
    (await screen.findByRole("button", { name: "Back" })).click();
    expect(onClick).toHaveBeenCalledOnce();
  });
});
