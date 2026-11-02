import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentMarketplaceCoursesRow } from "./ContentMarketplaceCoursesRow";

const state = vi.hoisted(() => ({ canBrowse: true, enabled: true, isError: false }));
const listingsQuery = vi.hoisted(() => vi.fn(() => ({ data: { data: [{ id: "course" }] } })));
vi.mock("~/hooks/usePermissions", () => ({
  usePermissions: () => ({ hasAccess: state.canBrowse }),
}));
vi.mock("~/api/queries/useContentMarketplaceConfiguration", () => ({
  useContentMarketplaceConfiguration: () => ({
    data: { enabled: state.enabled },
    isError: state.isError,
  }),
}));
vi.mock("~/api/queries/useContentMarketplaceListings", () => ({
  useContentMarketplaceListings: listingsQuery,
}));
vi.mock("./ContentMarketplaceListingCard", () => ({
  ContentMarketplaceListingCard: () => <div>Marketplace course card</div>,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

vi.mock("~/components/ui/carousel", () => {
  const Wrapper = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Carousel: Wrapper,
    CarouselContent: Wrapper,
    CarouselItem: Wrapper,
    CarouselNext: () => null,
    CarouselPrevious: () => null,
  };
});

function renderRow() {
  return render(
    <MemoryRouter>
      <ContentMarketplaceCoursesRow />
    </MemoryRouter>,
  );
}

describe("ContentMarketplaceCoursesRow", () => {
  beforeEach(() => {
    Object.assign(state, { canBrowse: true, enabled: true, isError: false });
    vi.clearAllMocks();
  });

  it("renders only a heading and browse link without fetching or rendering listings", () => {
    const { container } = renderRow();
    expect(screen.getByRole("heading", { name: "contentMarketplace.title" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "contentMarketplace.browseAll" })).toHaveAttribute(
      "href",
      "/content-marketplace",
    );
    expect(screen.queryByText("Marketplace course card")).not.toBeInTheDocument();
    expect(screen.queryByText("contentMarketplace.description")).not.toBeInTheDocument();
    expect(container.querySelector("section")?.children).toHaveLength(1);
    expect(listingsQuery).not.toHaveBeenCalled();
  });

  it.each([
    { canBrowse: false, enabled: true, isError: false },
    { canBrowse: true, enabled: false, isError: false },
    { canBrowse: true, enabled: true, isError: true },
  ])("hides the catalog entry when unavailable: %j", (configuration) => {
    Object.assign(state, configuration);
    const { container } = renderRow();
    expect(container).toBeEmptyDOMElement();
    expect(listingsQuery).not.toHaveBeenCalled();
  });
});
