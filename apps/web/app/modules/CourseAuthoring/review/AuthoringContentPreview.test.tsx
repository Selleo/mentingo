import { screen, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";

import { renderWith } from "~/utils/testUtils";

import { AuthoringContentPreview } from "./AuthoringContentPreview";

it("replaces the in-place loading node with the inline diagram when its preview becomes ready", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const content = `<img data-authoring-asset-id="${id}" alt="Architecture diagram">`;
  const view = renderWith({}).render(<AuthoringContentPreview content={content} />);
  expect(screen.getAllByRole("status")).toHaveLength(1);
  expect(screen.getByRole("status").textContent).toMatch(/Architecture diagram/);
  expect(screen.getByText("Architecture diagram")).toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  view.rerender(
    <AuthoringContentPreview content={content} assetPreviewUrls={{ [id]: "blob:diagram" }} />,
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole("img", { name: "Architecture diagram" })).toHaveAttribute(
      "src",
      "blob:diagram",
    ),
  );
  expect(screen.queryByText("Architecture diagram")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  expect(content).not.toContain("blob:");
  view.unmount();
});
