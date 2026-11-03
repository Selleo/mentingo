import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ContentMarketplaceListingCard } from "./ContentMarketplaceListingCard";

import type { ListContentMarketplaceListingsResponse } from "~/api/generated-api";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "pl" } }),
}));
vi.mock("~/components/RichText/Viever", () => ({ default: () => <p>Description</p> }));
vi.mock("./ContentMarketplaceThumbnail", () => ({
  ContentMarketplaceThumbnail: () => <div data-testid="thumbnail" />,
}));
vi.mock("./CopyListingPanel", () => ({ CopyListingPanel: () => <button>Add course</button> }));

const listing = {
  id: "course",
  versionId: "version",
  title: "Course title",
  description: "Description",
  hasThumbnail: true,
  updatedAt: "2026-11-02T12:00:00.000Z",
  metadata: { category: "Cyberbezpieczeństwo", lessonCount: 7, durationMinutes: 60 },
} as ListContentMarketplaceListingsResponse["data"][number];

describe("ContentMarketplaceListingCard", () => {
  it("anchors the category badge in the bottom-left corner of the thumbnail", () => {
    render(<ContentMarketplaceListingCard listing={listing} />);
    const badge = screen.getByText("Cyberbezpieczeństwo");
    expect(badge).toHaveClass("absolute", "bottom-3", "left-3");
    expect(badge).not.toHaveClass("top-3");
    expect(badge.parentElement).toContainElement(screen.getByTestId("thumbnail"));
  });

  it("does not render a badge for an uncategorized listing", () => {
    render(
      <ContentMarketplaceListingCard
        listing={{ ...listing, metadata: { ...listing.metadata, category: null } }}
      />,
    );
    expect(screen.queryByText("Cyberbezpieczeństwo")).not.toBeInTheDocument();
  });
});
