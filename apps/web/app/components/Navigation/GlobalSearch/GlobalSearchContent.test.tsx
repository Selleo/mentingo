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

describe("matching passages", () => {
  it("displays the content passage as escaped text with its attachment filename", () => {
    const { container } = renderContent("articles");
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
