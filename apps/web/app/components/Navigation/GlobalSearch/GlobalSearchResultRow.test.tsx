import { createRemixStub } from "@remix-run/testing";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

import { GlobalSearchResultRow } from "./GlobalSearchResultRow";

it("renders file evidence and passages as escaped plain text", async () => {
  const RemixStub = createRemixStub([
    {
      path: "/",
      Component: () => (
        <GlobalSearchResultRow
          to="/articles/1"
          onSelect={() => undefined}
          leading={null}
          title="Expenses"
          typeLabel="Article"
          isActive={false}
          matchedAttachmentFileName="policy.pdf"
          matchedPassage="<script>safe text</script>"
          showPassage
        />
      ),
    },
  ]);
  const { container } = render(<RemixStub />);
  expect(await screen.findByText("policy.pdf")).toBeInTheDocument();
  expect(screen.getByText("<script>safe text</script>")).toBeInTheDocument();
  expect(container.querySelector("script")).toBeNull();
});
