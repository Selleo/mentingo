import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringAssetDetails, AuthoringAssetTitle } from "./AuthoringAssetDetails";

import type { AssetRequestView } from "../courseAuthoring.types";

const sourceImage: AssetRequestView = {
  assetId: "source-asset",
  operationId: "lesson-operation",
  purpose: "lesson",
  required: false,
  altText: "Revenue increases in the second quarter",
  source: {
    type: "source_image",
    sourceVersionId: "source",
    sectionId: "figure",
    interpretationId: "interpretation",
  },
  placement: {
    anchorBlockId: "revenue-explanation",
    position: "after",
    caption: "Quarterly revenue from the supplied report",
    relevance: "Makes the lesson's revenue trend example visible",
  },
};

describe("source-image asset details", () => {
  it("keeps source-image details without an empty caption label when the caption is omitted", async () => {
    if (!sourceImage.placement) throw new Error("Source placement fixture missing");
    const { container } = renderWith().render(
      <AuthoringAssetDetails
        asset={{
          ...sourceImage,
          required: true,
          placement: { ...sourceImage.placement, caption: null },
        }}
      />,
    );
    await userEvent.click(screen.getByText("Details"));
    expect(screen.getByText(sourceImage.altText)).toBeVisible();
    expect(screen.getByText(sourceImage.placement.relevance)).toBeVisible();
    expect(container.querySelectorAll("details p")).toHaveLength(2);
    expect(screen.queryByText(/Generated visual:/)).not.toBeInTheDocument();
  });
  it("shows the source caption and placement rationale without calling it generated", async () => {
    const user = userEvent.setup();
    renderWith().render(<AuthoringAssetDetails asset={sourceImage} />);
    await user.click(screen.getByText("Details"));
    expect(screen.getByText(sourceImage.altText)).toBeVisible();
    expect(screen.getByText("Quarterly revenue from the supplied report")).toBeVisible();
    expect(screen.getByText("Makes the lesson's revenue trend example visible")).toBeVisible();
    expect(screen.queryByText(/Generated visual:/)).not.toBeInTheDocument();
  });

  it("uses a source-image title when a long alt text needs a compact fallback", () => {
    renderWith().render(
      <AuthoringAssetTitle
        asset={{ ...sourceImage, altText: "Detailed source image description ".repeat(10) }}
      />,
    );
    expect(screen.getByText("Source image")).toBeInTheDocument();
    expect(screen.queryByText("Generated visual")).not.toBeInTheDocument();
  });

  it("keeps generated visual details working for existing requests", async () => {
    const user = userEvent.setup();
    renderWith().render(
      <AuthoringAssetDetails
        asset={{
          ...sourceImage,
          placement: undefined,
          source: {
            type: "generated",
            content: "Explain the process in three steps",
            visualQuery: "Process",
          },
        }}
      />,
    );
    await user.click(screen.getByText("Details"));
    expect(screen.getByText("Generated visual: Explain the process in three steps")).toBeVisible();
    expect(
      screen.queryByText("Quarterly revenue from the supplied report"),
    ).not.toBeInTheDocument();
  });
});
