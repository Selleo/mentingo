import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { ContentDiffView } from "./ContentDiffView";

vi.mock("~/components/RichText/Viever", () => ({
  ContentViewer: ({ content }: { content: string }) => (
    <div data-testid="rendered-content" data-content={content} />
  ),
}));

it("resolves generated diagrams in Changes and After without mutating canonical HTML", async () => {
  const assetId = "00000000-0000-4000-8000-000000000001";
  const after = `<p>Explain the architecture.</p><img data-authoring-asset-id="${assetId}" alt="Architecture">`;
  renderWith({}).render(
    <ContentDiffView
      before="<p>Explain the architecture.</p>"
      after={after}
      assetPreviewUrls={{ [assetId]: "blob:diagram-preview" }}
    />,
  );
  const diagram = screen
    .getAllByTestId("rendered-content")
    .find((node) => node.getAttribute("data-content")?.includes("blob:diagram-preview"));
  expect(diagram).toBeDefined();
  expect(diagram?.getAttribute("data-content")).toContain('data-node-type="image"');
  await userEvent.click(screen.getByRole("tab", { name: "After" }));
  expect(screen.getByTestId("rendered-content").getAttribute("data-content")).toContain(
    'data-src="blob:diagram-preview"',
  );
  expect(after).not.toContain("blob:");
});
